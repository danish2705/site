import type {
  CombinedCatchmentResponse,
  LiveMapResponse,
  MapSiteRow,
  PatientSegments,
} from "../types.js";
import {
  getFacilitiesForCondition,
  getCompletedTrialBenchmarks,
  type LiveFacility,
} from "../services/ctgov.client.js";
import {
  geocodeApprox,
  getDistancesMilesBatch,
  haversineMiles,
  type LatLng,
} from "../services/geo.service.js";
import {
  getSyntheticPostalRegionsForCountry,
  type SyntheticPostalRegion,
} from "../data/syntheticPopulation.js";
import { buildLiveRegionRow } from "./liveRegionMetrics.js";
import { estimateSiteGeoRisk, llmStatus } from "../llm/client.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";
import { config } from "../config.js";
import {
  syntheticSiteCostFor,
  syntheticConsentRateFor,
} from "../data/syntheticSiteCost.js";
import { buildSyntheticPatientSample } from "../data/syntheticPatients.js";

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

export type CatchmentDistanceSource = MapSiteRow["catchmentDistanceSource"];

interface CatchmentResult {
  populationInRadius: number;
  distanceSource: CatchmentDistanceSource;
  /** Postal-region ids actually counted inside the radius — used by buildCombinedCatchment to de-duplicate overlap across multiple sites. */
  coveredRegions: SyntheticPostalRegion[];
}

async function computeCatchment(
  origin: LatLng,
  postalRegions: SyntheticPostalRegion[],
  radiusMiles: number,
): Promise<CatchmentResult> {
  const candidates = postalRegions.filter(
    (region) =>
      haversineMiles(origin, region) <=
      radiusMiles * config.map.catchmentPrefilterFactor,
  );
  if (candidates.length === 0) {
    return { populationInRadius: 0, distanceSource: "none", coveredRegions: [] };
  }

  const distances = await getDistancesMilesBatch(origin, candidates);

  let populationInRadius = 0;
  const coveredRegions: SyntheticPostalRegion[] = [];
  let sawLive = false;
  let sawApprox = false;
  candidates.forEach((region, i) => {
    const d = distances[i];
    if (d.miles <= radiusMiles) {
      populationInRadius += region.population;
      coveredRegions.push(region);
      if (d.source === "approximate-haversine") sawApprox = true;
      else sawLive = true;
    }
  });

  const distanceSource: CatchmentDistanceSource =
    coveredRegions.length === 0
      ? "none"
      : sawLive && sawApprox
        ? "mixed"
        : sawLive
          ? // Prefer reporting whichever live tier was actually used; both
            // tiers are grouped as "live" here since a mixed google/osrm
            // split isn't distinguished per-point by this function — good
            // enough for an honesty signal, not meant as a precise audit.
            (distances.find((d) => d.source !== "approximate-haversine")
              ?.source ?? "live-google")
          : "approximate-haversine";

  return { populationInRadius, distanceSource, coveredRegions };
}

/**
 * Illustrative split of a site's net-available patients into treatment-stage
 * buckets (see config.map.patientSegmentSplit's doc comment for why this is
 * a fixed heuristic, not real claims data). Returns null for a
 * netAvailablePatients of 0 — there's nothing to split.
 */
function splitPatientSegments(netAvailablePatients: number): PatientSegments | null {
  if (netAvailablePatients <= 0) return null;
  const split = config.map.patientSegmentSplit;
  return {
    newlyDiagnosed: Math.round(netAvailablePatients * split.newlyDiagnosed),
    nonResponder: Math.round(netAvailablePatients * split.nonResponder),
    stableOnTreatment: Math.round(
      netAvailablePatients * split.stableOnTreatment,
    ),
  };
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
      const catchment = await computeCatchment(
        geocode.point,
        postalRegions,
        radiusMiles,
      );
      const populationInRadius = catchment.populationInRadius;

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

      const siteId = siteIdFor(f.facility ?? "unknown", f.city, country);
      const siteCost = syntheticSiteCostFor(siteId, country);

      // Second, distinct haircut from recruitmentRate above: netAvailablePatients
      // already estimates "how many eligible patients aren't already absorbed
      // by other trials" — this answers "of those, how many will actually
      // consent to enroll in THIS trial once approached," which no live or
      // LLM source discloses (see config.siteCombination.assumedConsentRate's
      // doc comment). Previously this was one flat rate applied identically
      // to every site, which looked suspiciously uniform across a whole
      // results table. This now generates a deterministic per-site VARIATION
      // around that same configured center — still fabricated (no live/LLM
      // source exists for a real per-site consent rate either), but no
      // longer an obviously-repeated constant. See
      // data/syntheticSiteCost.ts's syntheticConsentRateFor for the range.
      const assumedConsentRate = syntheticConsentRateFor(
        siteId,
        country,
        config.siteCombination.assumedConsentRate,
      );
      const recruitablePatients = Math.max(
        0,
        Math.round(netAvailablePatients * assumedConsentRate),
      );

      // Requirement #1: "eligible − already enrolled = available," made
      // explicit rather than left implicit inside netAvailablePatients.
      // Derived arithmetically (not re-estimated) so the three numbers
      // always reconcile exactly: gross = alreadyEnrolled + netAvailable.
      const alreadyEnrolledPatients = Math.max(
        0,
        grossEligiblePatients - netAvailablePatients,
      );
      // Requirement #4: small illustrative per-site patient-record sample,
      // whose Available/Enrolled mix matches this exact recruitmentRate —
      // see data/syntheticPatients.ts for why this is a sample, not the
      // full population.
      const patientSample = buildSyntheticPatientSample(
        siteId,
        params.indication,
        recruitmentRate,
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
        siteId,
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
        recruitablePatients,
        assumedConsentRate,
        siteCost,
        alreadyEnrolledPatients,
        patientSample,
        riskScore,
        riskLevel,
        riskRationale,
        riskSource: llmConfigured ? "llm-estimated" : "unavailable",
        patientSegments: splitPatientSegments(netAvailablePatients),
        patientSegmentSource: "heuristic-illustrative",
        catchmentDistanceSource: catchment.distanceSource,
      };
    }),
  );

  warnings.push(
    "Patient-segment breakdown (newly-diagnosed / non-responder / stable-on-treatment) is an illustrative fixed split, not derived from real claims/EHR data — no live source distinguishes these groups per site at this granularity.",
  );
  warnings.push(
    "\"Already Enrolled\" and the per-site patient-record sample are synthetic — no live source discloses real per-patient trial-enrollment status. The sample's Available/Enrolled mix matches each site's already-enrolled-elsewhere rate, but it is an illustrative 25-record sample, not a census of real patients.",
  );

  const approxDistanceCount = sites.filter(
    (s) =>
      s.catchmentDistanceSource === "approximate-haversine" ||
      s.catchmentDistanceSource === "mixed",
  ).length;
  if (approxDistanceCount > 0) {
    warnings.push(
      `${approxDistanceCount} of ${sites.length} site(s) had some or all of their catchment radius decided by straight-line distance rather than real driving distance (Google Distance Matrix / OSRM lookup unavailable for those points) — their patient counts are a rougher approximation than the others.`,
    );
  }

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

export interface CombinedCatchmentSiteInput {
  siteId: string;
  lat: number;
  lng: number;
  /** This site's own netAvailablePatients, as already returned by buildLiveSiteMapData — reused as-is here (rather than recomputed) so the "naive sum" side of the comparison always matches exactly what the caller is already showing the user. */
  netAvailablePatients: number;
}

export interface BuildCombinedCatchmentParams {
  indication: string;
  specialty: string;
  /** All input sites are assumed to be in this single country — the synthetic catchment dataset and prevalence estimate are both country-scoped (see data/syntheticPopulation.ts), so mixing countries in one combined-catchment call isn't supported. */
  country: string;
  radiusMiles?: number;
  sites: CombinedCatchmentSiteInput[];
}

export async function buildCombinedCatchment(
  params: BuildCombinedCatchmentParams,
): Promise<CombinedCatchmentResponse> {
  const radiusMiles =
    params.radiusMiles && params.radiusMiles > 0
      ? params.radiusMiles
      : config.map.defaultRadiusMiles;
  const warnings: string[] = [];

  const sumOfIndividualNetAvailablePatients = params.sites.reduce(
    (sum, s) => sum + s.netAvailablePatients,
    0,
  );

  if (params.sites.length < 2) {
    warnings.push(
      "Select at least 2 sites to see how much their catchments overlap — with fewer than 2 selected, the combined figure is the same as the individual one by definition.",
    );
  }

  const postalRegions = getSyntheticPostalRegionsForCountry(params.country);
  const coveredPopulationById = new Map<string, number>();
  for (const site of params.sites) {
    const catchment = await computeCatchment(
      { lat: site.lat, lng: site.lng },
      postalRegions,
      radiusMiles,
    );
    for (const region of catchment.coveredRegions) {
      coveredPopulationById.set(region.id, region.population);
    }
  }
  const combinedPopulationInRadius = [
    ...coveredPopulationById.values(),
  ].reduce((sum, population) => sum + population, 0);

  let prevalencePer100k = 0;
  try {
    const regionRow = await buildLiveRegionRow({
      region: regionLabelForCountry(params.country),
      country: params.country,
      indication: params.indication,
      specialty: params.specialty,
    });
    prevalencePer100k = regionRow["Prevalence (per 100k)"];
  } catch (err) {
    warnings.push(
      `Could not estimate prevalence for ${params.country} (${(err as Error).message}) — combined patient count shown as 0.`,
    );
  }

  const combinedGrossEligiblePatients = Math.round(
    ((combinedPopulationInRadius * prevalencePer100k) / 100000) *
      config.map.addressableFraction,
  );
  const benchmark = await getCompletedTrialBenchmarks(params.indication).catch(
    () => null,
  );
  const recruitmentRate =
    benchmark?.medianSampleSize && combinedGrossEligiblePatients > 0
      ? clamp(
          benchmark.medianSampleSize / combinedGrossEligiblePatients,
          0.05,
          0.6,
        )
      : config.map.baselineRecruitmentRate;
  const combinedNetAvailablePatients = Math.max(
    0,
    Math.round(combinedGrossEligiblePatients * (1 - recruitmentRate)),
  );

  const overlapPatients = Math.max(
    0,
    sumOfIndividualNetAvailablePatients - combinedNetAvailablePatients,
  );

  return {
    indication: params.indication,
    country: params.country,
    radiusMiles,
    siteCount: params.sites.length,
    sumOfIndividualNetAvailablePatients,
    combinedNetAvailablePatients,
    overlapPatients,
    prevalencePer100k,
    warnings,
  };
}
