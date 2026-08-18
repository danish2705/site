import type { LiveMapResponse, MapSiteRow } from "../types.js";
import {
  getFacilitiesForCondition,
  getCompletedTrialBenchmarks,
  type LiveFacility,
} from "../services/ctgov.client.js";
import { geocodeApprox, haversineMiles } from "../services/geo.service.js";
import { getSyntheticPostalRegionsForCountry } from "../data/syntheticPopulation.js";
import { buildLiveRegionRow } from "./liveRegionMetrics.js";
import { estimateSiteGeoRisk, llmStatus } from "../llm/client.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";
import { config } from "../config.js";

function regionLabelForCountry(country: string): string {
  const match = REGION_DEFINITIONS.find(
    (r) => r.country.toLowerCase() === country.toLowerCase(),
  );
  return match?.region ?? "Global";
}

function dedupeFacilities(facilities: LiveFacility[]): LiveFacility[] {
  const seen = new Set<string>();
  const out: LiveFacility[] = [];
  for (const f of facilities) {
    if (!f.facility || !f.country) continue;
    const key = `${f.facility}|${f.city ?? ""}|${f.country}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function siteIdFor(
  facility: string,
  city: string | null,
  country: string,
): string {
  const raw = `${facility}|${city ?? ""}|${country}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `MAP-${Math.abs(h).toString(36).toUpperCase()}`;
}

export interface BuildLiveSiteMapParams {
  indication: string;
  specialty: string;
  /** Omit/empty = global — every country ClinicalTrials.gov returns for this indication. */
  country?: string;
  radiusMiles?: number;
  /** Cap on how many real facilities to plot — each one costs an LLM risk-estimate call. */
  maxSites?: number;
}

export async function buildLiveSiteMapData(
  params: BuildLiveSiteMapParams,
): Promise<LiveMapResponse> {
  const radiusMiles =
    params.radiusMiles && params.radiusMiles > 0
      ? params.radiusMiles
      : config.map.defaultRadiusMiles;
  const maxSites = params.maxSites ?? 40;
  const warnings: string[] = [];

  const rawFacilities = await getFacilitiesForCondition(params.indication, {
    country: params.country || undefined,
    pageSize: maxSites * 2,
  });
  const facilities = dedupeFacilities(rawFacilities).slice(0, maxSites);

  if (facilities.length === 0) {
    return {
      indication: params.indication,
      country: params.country || null,
      radiusMiles,
      sites: [],
      warnings: [
        `No live ClinicalTrials.gov sites found for "${params.indication}"` +
          (params.country ? ` in ${params.country}.` : " in any country."),
      ],
      fetchedAt: new Date().toISOString(),
    };
  }

  const benchmark = await getCompletedTrialBenchmarks(params.indication).catch(
    () => null,
  );

  // Prevalence is region/country-specific (LLM-estimated — no public source
  // publishes it at this granularity, see liveRegionMetrics.ts) — cache one
  // lookup per distinct country present in this run's facilities instead of
  // one per site, since a global search can span dozens of sites per
  // country.
  const countries = [
    ...new Set(
      facilities.map((f) => f.country).filter((c): c is string => !!c),
    ),
  ];
  const regionRowByCountry = new Map<
    string,
    Awaited<ReturnType<typeof buildLiveRegionRow>>
  >();
  await Promise.all(
    countries.map(async (country) => {
      try {
        const row = await buildLiveRegionRow({
          region: regionLabelForCountry(country),
          country,
          indication: params.indication,
          specialty: params.specialty,
        });
        regionRowByCountry.set(country, row);
      } catch {
        warnings.push(
          `Could not estimate prevalence for ${country} — patient counts for its sites are shown as 0.`,
        );
      }
    }),
  );

  const { configured: llmConfigured } = llmStatus();
  if (!llmConfigured) {
    warnings.push(
      "LLM not configured — site risk scores are unavailable (shown as Unknown) until an OPENAI_API_KEY or AZURE_OPENAI_* key is set.",
    );
  }

  const sites = await Promise.all(
    facilities.map(async (f): Promise<MapSiteRow> => {
      const country = f.country ?? params.country ?? "Unknown";
      const geocode = await geocodeApprox(f.city, f.state, country);
      const postalRegions = getSyntheticPostalRegionsForCountry(country);
      let populationInRadius = 0;
      for (const region of postalRegions) {
        if (haversineMiles(geocode.point, region) <= radiusMiles) {
          populationInRadius += region.population;
        }
      }

      const regionRow = regionRowByCountry.get(country);
      const prevalencePer100k = regionRow?.["Prevalence (per 100k)"] ?? 0;
      // Raw prevalence math (population-in-radius x prevalence-per-100k)
      // counts every person with the condition, not just the fraction
      // actually reachable/eligible for THIS site — see config.map's
      // addressableFraction doc comment for why that haircut exists.
      const grossEligiblePatients = Math.round(
        ((populationInRadius * prevalencePer100k) / 100000) *
          config.map.addressableFraction,
      );

      const recruitmentRate =
        benchmark?.medianSampleSize && grossEligiblePatients > 0
          ? clamp(benchmark.medianSampleSize / grossEligiblePatients, 0.05, 0.6)
          : config.map.baselineRecruitmentRate;
      const netAvailablePatients = Math.max(
        0,
        Math.round(grossEligiblePatients * (1 - recruitmentRate)),
      );

      let riskScore: number | null = null;
      let riskLevel: MapSiteRow["riskLevel"] = "Unknown";
      let riskRationale =
        "LLM not configured — no risk estimate available for this site.";
      if (llmConfigured) {
        try {
          const risk = await estimateSiteGeoRisk({
            facilityName: f.facility ?? "Unknown facility",
            city: f.city,
            state: f.state,
            country,
            indication: params.indication,
          });
          riskScore = risk.riskScore;
          riskLevel = risk.riskLevel;
          riskRationale = risk.rationale;
        } catch (err) {
          riskRationale = `Risk estimate failed: ${(err as Error).message}`;
        }
      }

      return {
        siteId: siteIdFor(f.facility ?? "unknown", f.city, country),
        siteName: f.facility ?? "Unknown facility",
        city: f.city,
        state: f.state,
        country,
        status: f.status,
        lat: geocode.point.lat,
        lng: geocode.point.lng,
        coordsSource: geocode.source,
        radiusMiles,
        populationInRadius,
        populationSource: "synthetic",
        prevalencePer100k,
        grossEligiblePatients,
        netAvailablePatients,
        recruitmentRateAssumed: Math.round(recruitmentRate * 1000) / 1000,
        riskScore,
        riskLevel,
        riskRationale,
        riskSource: llmConfigured ? "llm-estimated" : "unavailable",
      };
    }),
  );

  // Coordinates are only "approximate" (not real geocoding) if BOTH the
  // Google tier (no key configured, or the call failed) and the free
  // Nominatim tier (network hiccup, no match, etc.) fell through for a
  // given site — see services/geo.service.ts's fallback chain. Report the
  // count actually affected rather than a blanket warning, since most
  // sites should resolve via one of the two live tiers.
  const approxCoordsCount = sites.filter(
    (s) => s.coordsSource === "approximate",
  ).length;
  if (approxCoordsCount > 0) {
    warnings.push(
      `${approxCoordsCount} of ${sites.length} site(s) could not be geocoded via Google Maps or the free OpenStreetMap lookup — their position on the map is an approximation near the facility's city/country, not precise.`,
    );
  }

  return {
    indication: params.indication,
    country: params.country || null,
    radiusMiles,
    sites,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}
