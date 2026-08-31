import { createHash } from "node:crypto";
import type { SiteRow } from "../types.js";
import type { ExtendedEvaluationRow } from "./scoring.js";
import {
  getFacilitiesForCondition,
  getCompletedTrialBenchmarks,
  getFacilityHistories,
  getFacilityWideHistory,
  getFacilityResultsSignal,
  type LiveFacility,
  type FacilityHistory,
  type FacilityTrialRecord,
  type FacilityResultsSignal,
} from "../services/ctgov.client.js";
import {
  estimateSiteKpis,
  llmStatus,
  type SiteKpiEstimateFields,
} from "../llm/client.js";
import { countActiveFacilityWorkload } from "./liveRiskAssessment.js";
import { config } from "../config.js";
import { allSettledWithConcurrency } from "../utils/concurrency.js";
import {
  syntheticSiteCostFor,
  type SyntheticSiteCost,
} from "../data/syntheticSiteCost.js";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function monthsBetween(start: string, end: string): number | null {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return months > 0 ? months : null;
}

function computeRealEnrollmentRate(
  trials: FacilityTrialRecord[],
): number | null {
  const rates: number[] = [];
  for (const t of trials) {
    if (t.enrollmentType !== "ACTUAL" || typeof t.enrollmentCount !== "number") {
      continue;
    }
    if (!t.startDate || !t.primaryCompletionDate) continue;
    const months = monthsBetween(t.startDate, t.primaryCompletionDate);
    if (months === null) continue;
    rates.push(t.enrollmentCount / months);
  }
  return median(rates);
}

function pickResultsNctId(
  history: FacilityHistory | undefined,
  facilityWideHistory: FacilityHistory | null | undefined,
): string | null {
  const pool = [
    ...(facilityWideHistory?.trials ?? []),
    ...(history?.trials ?? []),
  ].filter((t) => t.hasResults === true && t.nctId);
  if (pool.length === 0) return null;
  pool.sort((a, b) => {
    const ad = a.primaryCompletionDate ?? a.lastUpdatePostDate ?? "";
    const bd = b.primaryCompletionDate ?? b.lastUpdatePostDate ?? "";
    return bd.localeCompare(ad);
  });
  return pool[0].nctId;
}

function applyLiveKpiOverrides(
  evalRow: ExtendedEvaluationRow,
  real: {
    realEnrollmentRate: number | null;
    resultsSignal: FacilityResultsSignal | null;
    realActiveWorkload: number | null;
  },
): ExtendedEvaluationRow {
  const liveKpiFields: string[] = [];
  const out: ExtendedEvaluationRow = { ...evalRow };

  if (real.realEnrollmentRate !== null) {
    out["Historical Enrollment Rate (pts/month)"] =
      Math.round(real.realEnrollmentRate * 10) / 10;
    liveKpiFields.push("Historical Enrollment Rate (pts/month)");
  }
  if (real.resultsSignal?.dropoutRatePercent != null) {
    out["Dropout Rate (%)"] = real.resultsSignal.dropoutRatePercent;
    liveKpiFields.push("Dropout Rate (%)");
  }
  if (real.resultsSignal?.diversityIndex != null) {
    out["Diversity Index (0-100)"] = real.resultsSignal.diversityIndex;
    liveKpiFields.push("Diversity Index (0-100)");
    out.raceBreakdown = real.resultsSignal.raceBreakdown ?? null;
  }
  if (real.realActiveWorkload !== null) {
    out["Competing Trials at Site"] = real.realActiveWorkload;
    liveKpiFields.push("Competing Trials at Site");
  }

  if (liveKpiFields.length > 0) {
    out.liveKpiFields = liveKpiFields;
    out.liveKpiSourceNctId = real.resultsSignal?.sourceNctId ?? null;
    out.estimateRationale =
      `${out.estimateRationale ?? ""}` +
      `${out.estimateRationale ? " " : ""}` +
      `[Real ClinicalTrials.gov data overrides the LLM estimate for: ${liveKpiFields.join(", ")}` +
      (real.resultsSignal
        ? ` — Dropout Rate/Diversity Index are from ${real.resultsSignal.sourceNctId}'s posted results (trial-wide across all its sites, not this facility alone).`
        : ".") +
      `]`;
  }
  return out;
}

export interface LiveCandidateSite {
  site: SiteRow;
  evalRow: ExtendedEvaluationRow | null;
  warning: string | null;
  history?: FacilityHistory;
  facilityWideHistory?: FacilityHistory | null;
  nearbyCompetingTrials: number;
  benchmarkMedianSampleSize: number | null;
  resultsSignal: FacilityResultsSignal | null;
  siteCost: SyntheticSiteCost;
}

export const RECRUITING_LOCATION_STATUSES = new Set([
  "RECRUITING",
  "NOT_YET_RECRUITING",
]);

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
    if (ownName && (p.facility ?? "").trim().toLowerCase() === ownName) {
      return false;
    }
    return true;
  }).length;
}

interface EstimateCacheEntry {
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

const GENERIC_FACILITY_NAME =
  /^(research site|clinical (trial |research )?site|investigational site|site\s*\d*|study site)$/i;

function displayNameFor(f: LiveFacility): string {
  const base = (f.facility ?? "Unknown facility").trim();
  if (!GENERIC_FACILITY_NAME.test(base)) return base;
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

const CANDIDATE_STATUS_TIERS = [
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ACTIVE_NOT_RECRUITING",
];

function selectBalancedByStatus(
  facilities: LiveFacility[],
  maxSites: number,
): LiveFacility[] {
  const realBuckets = CANDIDATE_STATUS_TIERS.map((tier) =>
    facilities.filter((f) => (f.status ?? "").toUpperCase() === tier),
  );
  const otherBucket = facilities.filter(
    (f) => !CANDIDATE_STATUS_TIERS.includes((f.status ?? "").toUpperCase()),
  );

  const result: LiveFacility[] = [];
  let tookAny = true;
  while (result.length < maxSites && tookAny) {
    tookAny = false;
    for (const bucket of realBuckets) {
      if (result.length >= maxSites) break;
      const next = bucket.shift();
      if (next) {
        result.push(next);
        tookAny = true;
      }
    }
  }
  while (result.length < maxSites && otherBucket.length > 0) {
    result.push(otherBucket.shift() as LiveFacility);
  }
  return result;
}

export interface BuildLiveCandidateSitesParams {
  indication: string;
  specialty: string;
  region: string;
  country: string;
  regulatoryWeeks: number;
  regionCompetingTrials: number;
  avgCostPerPatient: number;
  maxSites?: number;
  ageGroups?: string[];
  facilities?: LiveFacility[];
}

export async function buildLiveCandidateSites(
  params: BuildLiveCandidateSitesParams,
): Promise<LiveCandidateSite[]> {
  const maxSites = params.maxSites ?? 40;

  const rawFacilities =
    params.facilities && params.facilities.length > 0
      ? params.facilities
      : await getFacilitiesForCondition(params.indication, {
          country: params.country,
          pageSize: Math.max(maxSites * 6, 200),
          ageGroups: params.ageGroups,
          statuses: config.competingTrials.statuses,
        });
  const facilities = selectBalancedByStatus(
    dedupeFacilities(rawFacilities),
    maxSites,
  );
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

  const results = await allSettledWithConcurrency(
    facilities,
    config.ctgov.facilityConcurrency,
    async (f): Promise<LiveCandidateSite> => {
      const siteId = siteIdFor(f.facility!, f.city, f.country);
      const historyKey = `${f.facility}|${f.city ?? ""}|${f.country ?? ""}`.toLowerCase();
      const history = histories.get(historyKey);
      const nearbyCompetingTrials = countNearbyCompetingTrials(f, competingPool);
      const siteCost = syntheticSiteCostFor(siteId, f.country ?? params.country);
      const facilityWideHistory = await getFacilityWideHistory(
        f.facility!,
        f.city,
        f.country,
      );
      const realActiveWorkload = countActiveFacilityWorkload(facilityWideHistory);
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
        recruitingStatus: f.status ?? null,
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
          resultsSignal: null,
          siteCost,
        };
      }

      const enrollmentPool =
        facilityWideHistory?.trials ?? history?.trials ?? [];
      const realEnrollmentRate = computeRealEnrollmentRate(enrollmentPool);
      const resultsNctId = pickResultsNctId(history, facilityWideHistory);
      const resultsSignal = resultsNctId
        ? await getFacilityResultsSignal(resultsNctId).catch(() => null)
        : null;
      const realKpiSignal = { realEnrollmentRate, resultsSignal, realActiveWorkload };

      const cacheKey = `${siteId}|${params.indication}`;
      const cached = estimateCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        const evalRow = applyLiveKpiOverrides(
          {
            "Site ID": siteId,
            ...cached.fields,
            dataSource: "llm-estimated",
            estimateRationale: cached.rationale,
          } as unknown as ExtendedEvaluationRow,
          realKpiSignal,
        );
        return {
          site,
          evalRow,
          warning: null,
          history,
          facilityWideHistory,
          nearbyCompetingTrials,
          benchmarkMedianSampleSize,
          resultsSignal,
          siteCost,
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
        const evalRow = applyLiveKpiOverrides(
          {
            "Site ID": siteId,
            ...estimate.fields,
            dataSource: "llm-estimated",
            estimateRationale: estimate.rationale,
          } as unknown as ExtendedEvaluationRow,
          realKpiSignal,
        );
        return {
          site,
          evalRow,
          warning: null,
          history,
          facilityWideHistory,
          nearbyCompetingTrials,
          benchmarkMedianSampleSize,
          resultsSignal,
          siteCost,
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
          resultsSignal,
          siteCost,
        };
      }
    },
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
            recruitingStatus: facilities[i].status ?? null,
          },
          evalRow: null,
          warning: `${facilities[i].facility ?? "A live site"}: unexpected error building this candidate — shown but not scored.`,
          nearbyCompetingTrials: countNearbyCompetingTrials(
            facilities[i],
            competingPool,
          ),
          facilityWideHistory: null,
          benchmarkMedianSampleSize,
          resultsSignal: null,
          siteCost: syntheticSiteCostFor(
            siteIdFor(facilities[i].facility ?? "unknown", null, null),
            params.country,
          ),
        },
  );
}
