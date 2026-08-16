/**
 * Builds candidate sites from real, live ClinicalTrials.gov facilities for a
 * region/indication, and estimates their Site_Evaluation KPIs via the LLM
 * (since ClinicalTrials.gov has no operational data on any site).
 *
 * Per-facility failure handling is explicit, never silent:
 *  - LLM not configured  -> site is returned with evalRow: null + a warning.
 *  - LLM call fails/parses badly -> same: evalRow: null + a warning.
 * No mock/fabricated KPI numbers are ever substituted in either case; a site
 * with evalRow: null simply doesn't get scored (same as an Excel site with
 * no Site_Evaluation row today), and the warning explains why.
 */
import { createHash } from "node:crypto";
import type { SiteRow } from "../types.js";
import type { ExtendedEvaluationRow } from "./scoring.js";
import {
  getFacilitiesForCondition,
  getCompletedTrialBenchmarks,
  getFacilityHistories,
  getFacilityWideHistory,
  type LiveFacility,
  type FacilityHistory,
} from "../services/ctgov.client.js";
import {
  estimateSiteKpis,
  llmStatus,
  type SiteKpiEstimateFields,
} from "../llm/client.js";
import { config } from "../config.js";

export interface LiveCandidateSite {
  site: SiteRow;
  evalRow: ExtendedEvaluationRow | null;
  warning: string | null;
  /** Real trial-status history for this facility, SCOPED TO THIS INDICATION — used for the per-trial category rows (Enrollment/Safety/Operational/etc, Protocol Complexity) and as a fallback rate source. */
  history?: FacilityHistory;
  /**
   * Real trial-status history for this facility across ALL indications
   * (query.locn on facility name, no condition filter) — a bigger, steadier
   * sample for the Trial History Likelihood rate and the Data Integrity
   * overdue-results check than the indication-scoped `history` above, which
   * is often just 1-2 trials. null if the lookup found nothing or failed;
   * callers should fall back to `history` in that case. See the precision
   * caveat on getFacilityWideHistory in ctgov.client.ts.
   */
  facilityWideHistory?: FacilityHistory | null;
  /**
   * Real, per-facility count of OTHER actively-recruiting/not-yet-recruiting
   * trial locations for this indication in the same city — used for the
   * Competitive risk-register category instead of reusing one country-wide
   * total for every site in the run. Capped by COMPETING_POOL_PAGE_SIZE, so
   * a very crowded field could still undercount rather than overcount.
   */
  nearbyCompetingTrials: number;
  /**
   * Real median completed-trial sample size for this indication (from
   * getCompletedTrialBenchmarks, already fetched once per region/indication
   * for the LLM KPI estimate) — reused for the Enrollment-shortfall risk
   * signal, comparing a facility's own ACTUAL enrollment counts against this
   * benchmark. null if the LLM benchmark call wasn't made/failed.
   */
  benchmarkMedianSampleSize: number | null;
}

const RECRUITING_LOCATION_STATUSES = new Set([
  "RECRUITING",
  "NOT_YET_RECRUITING",
]);

// Deliberately larger than the maxSites*2 pull used to find candidate sites
// themselves — this pool exists purely to count nearby competing activity,
// so it needs broader coverage of the same indication/country, not just
// enough rows to find a handful of candidates.
const COMPETING_POOL_PAGE_SIZE = 150;

function countNearbyCompetingTrials(
  facility: LiveFacility,
  pool: LiveFacility[],
): number {
  if (!facility.city) return 0;
  const cityKey = facility.city.trim().toLowerCase();
  const ownName = (facility.facility ?? "").trim().toLowerCase();
  return pool.filter((p) => {
    if (!p.city || p.city.trim().toLowerCase() !== cityKey) return false;
    if (!p.status || !RECRUITING_LOCATION_STATUSES.has(p.status)) return false;
    // Exclude this exact facility's own listing(s) so a site never counts as
    // its own competitor.
    if (ownName && (p.facility ?? "").trim().toLowerCase() === ownName) {
      return false;
    }
    return true;
  }).length;
}

interface EstimateCacheEntry {
  // SiteKpiEstimateFields (not Partial<ExtendedEvaluationRow>) — this is the
  // LLM's actual return shape, where an un-estimable field is `null`, not
  // `undefined`. The `as unknown as ExtendedEvaluationRow` casts below
  // handle reconciling that with EvaluationRow's stricter field types.
  fields: SiteKpiEstimateFields;
  rationale: string;
  expiresAt: number;
}
const estimateCache = new Map<string, EstimateCacheEntry>();

function siteIdFor(facility: string, city: string | null, country: string | null): string {
  const key = `${facility}|${city ?? ""}|${country ?? ""}`.toLowerCase();
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 8).toUpperCase();
  return `LIVE-${hash}`;
}

// ClinicalTrials.gov sponsors commonly register a generic placeholder instead
// of the real facility name for blinded/anonymized site listings — there is
// no real name to recover underneath. This only makes such rows
// distinguishable using OTHER real fields we already have (city/state),
// never a fabricated name.
const GENERIC_FACILITY_NAME =
  /^(research site|clinical (trial |research )?site|investigational site|site\s*\d*|study site)$/i;

function displayNameFor(f: LiveFacility): string {
  const base = (f.facility ?? "Unknown facility").trim();
  if (!GENERIC_FACILITY_NAME.test(base)) return base;
  // Generic placeholder ("Research Site", etc.) — show the real locality
  // alone rather than prefixing the generic label, since the label itself
  // carries no identifying information.
  const locality = [f.city, f.state].filter(Boolean).join(", ") || f.country;
  return locality || base;
}

function dedupeFacilities(facilities: LiveFacility[]): LiveFacility[] {
  const seen = new Set<string>();
  const out: LiveFacility[] = [];
  for (const f of facilities) {
    if (!f.facility) continue;
    const key = `${f.facility}|${f.city ?? ""}|${f.country ?? ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export interface BuildLiveCandidateSitesParams {
  indication: string;
  specialty: string;
  region: string;
  country: string;
  regulatoryWeeks: number;
  regionCompetingTrials: number;
  avgCostPerPatient: number;
  /** Cap on how many real facilities to pull/estimate per run — each one costs an LLM call. */
  maxSites?: number;
}

export async function buildLiveCandidateSites(
  params: BuildLiveCandidateSitesParams,
): Promise<LiveCandidateSite[]> {
  const maxSites = params.maxSites ?? 8;

  const rawFacilities = await getFacilitiesForCondition(params.indication, {
    country: params.country,
    pageSize: maxSites * 2, // fetch a few extra since some rows lack a facility name
  });
  const facilities = dedupeFacilities(rawFacilities).slice(0, maxSites);
  if (facilities.length === 0) return [];

  const { configured: llmConfigured } = llmStatus();
  const [benchmark, histories, competingPool] = await Promise.all([
    llmConfigured
      ? getCompletedTrialBenchmarks(params.indication)
      : Promise.resolve({
          sampleCount: 0,
          phaseDistribution: {} as Record<string, number>,
          medianSampleSize: null,
          medianDurationMonths: null,
          medianEnrollmentRatePerMonth: null,
        }),
    getFacilityHistories(params.indication, { country: params.country }),
    getFacilitiesForCondition(params.indication, {
      country: params.country,
      pageSize: COMPETING_POOL_PAGE_SIZE,
    }),
  ]);

  const benchmarkMedianSampleSize = benchmark.medianSampleSize ?? null;

  const results = await Promise.allSettled(
    facilities.map(async (f): Promise<LiveCandidateSite> => {
      const siteId = siteIdFor(f.facility!, f.city, f.country);
      const historyKey = `${f.facility}|${f.city ?? ""}|${f.country ?? ""}`.toLowerCase();
      const history = histories.get(historyKey);
      const nearbyCompetingTrials = countNearbyCompetingTrials(f, competingPool);
      // Best-effort, non-blocking: a failed/empty facility-wide lookup just
      // resolves to null (see getFacilityWideHistory's own try/catch) — never
      // throws, so it can't take down this facility's whole candidate build.
      const facilityWideHistory = await getFacilityWideHistory(
        f.facility!,
        f.city,
        f.country,
      );
      const site: SiteRow = {
        "Site ID": siteId,
        "Site Name": displayNameFor(f),
        Region: params.region,
        Country: f.country ?? params.country,
        City: f.city ?? "",
        "Therapeutic Area": params.specialty,
        "Hospital Type": "Unknown (live-sourced)",
        Accreditation: "Unknown",
        dataSource: "live",
      };

      if (!llmConfigured) {
        return {
          site,
          evalRow: null,
          warning: `${f.facility}: LLM is not configured, so no KPI estimate could be produced — this site is shown but not scored.`,
          history,
          facilityWideHistory,
          nearbyCompetingTrials,
          benchmarkMedianSampleSize,
        };
      }

      const cacheKey = `${siteId}|${params.indication}`;
      const cached = estimateCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        const evalRow = {
          "Site ID": siteId,
          ...cached.fields,
          dataSource: "llm-estimated",
          estimateRationale: cached.rationale,
        } as unknown as ExtendedEvaluationRow;
        return {
          site,
          evalRow,
          warning: null,
          history,
          facilityWideHistory,
          nearbyCompetingTrials,
          benchmarkMedianSampleSize,
        };
      }

      try {
        const estimate = await estimateSiteKpis({
          facilityName: f.facility!,
          city: f.city,
          state: f.state,
          country: f.country ?? params.country,
          indication: params.indication,
          specialty: params.specialty,
          region: params.region,
          regulatoryWeeks: params.regulatoryWeeks,
          regionCompetingTrials: params.regionCompetingTrials,
          avgCostPerPatient: params.avgCostPerPatient,
          benchmark,
        });
        estimateCache.set(cacheKey, {
          fields: estimate.fields,
          rationale: estimate.rationale,
          expiresAt: Date.now() + config.ctgov.cacheTtlMs,
        });
        const evalRow = {
          "Site ID": siteId,
          ...estimate.fields,
          dataSource: "llm-estimated",
          estimateRationale: estimate.rationale,
        } as unknown as ExtendedEvaluationRow;
        return {
          site,
          evalRow,
          warning: null,
          history,
          facilityWideHistory,
          nearbyCompetingTrials,
          benchmarkMedianSampleSize,
        };
      } catch (err) {
        return {
          site,
          evalRow: null,
          warning: `${f.facility}: LLM KPI estimate failed (${(err as Error).message}) — this site is shown but not scored.`,
          history,
          facilityWideHistory,
          nearbyCompetingTrials,
          benchmarkMedianSampleSize,
        };
      }
    }),
  );

  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          site: {
            "Site ID": siteIdFor(facilities[i].facility ?? "unknown", null, null),
            "Site Name": displayNameFor(facilities[i]),
            Region: params.region,
            Country: params.country,
            City: "",
            "Therapeutic Area": params.specialty,
            "Hospital Type": "Unknown (live-sourced)",
            Accreditation: "Unknown",
            dataSource: "live" as const,
          },
          evalRow: null,
          warning: `${facilities[i].facility ?? "A live site"}: unexpected error building this candidate — shown but not scored.`,
          nearbyCompetingTrials: countNearbyCompetingTrials(
            facilities[i],
            competingPool,
          ),
          facilityWideHistory: null,
          benchmarkMedianSampleSize,
        },
  );
}
