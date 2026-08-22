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

/**
 * Real, facility-specific enrollment-rate proxy: median of
 * (ACTUAL EnrollmentCount ÷ StartDate→PrimaryCompletionDate months) across
 * this facility's own on-file trials. null if no trial has enough real data
 * to compute even one rate — callers then keep the LLM estimate.
 */
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

/**
 * Picks one NCTId to pull a posted-results signal from: the facility's most
 * recently-completed on-file trial that has HasResults = true, preferring
 * the broader facility-wide pool (bigger sample) over the indication-scoped
 * one. null if nothing on file has posted results.
 */
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

/**
 * Overrides specific LLM-estimated KPI fields with real ClinicalTrials.gov
 * data when it's available, and records exactly which fields were replaced
 * (liveKpiFields) so the UI/caveats can say so honestly rather than treating
 * the whole row as either "all real" or "all estimated." Leaves every other
 * field (Quality, Cost, Staff Turnover, etc. — no live source exists) as the
 * LLM produced it.
 */
function applyLiveKpiOverrides(
  evalRow: ExtendedEvaluationRow,
  real: {
    realEnrollmentRate: number | null;
    resultsSignal: FacilityResultsSignal | null;
    /**
     * Real count of trials (any indication) this facility is currently
     * running — same number already used for the Risk Register's Site
     * Capacity category (see liveRiskAssessment.ts's
     * countActiveFacilityWorkload). Requirement #5 benchmark finding: this
     * real signal previously never reached the ranking score at all — the
     * "Competing Trials at Site" field scoring.ts reads was always an LLM
     * guess, even for a live-sourced facility with real data available.
     */
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
  /**
   * Real posted-results signal (dropout rate, diversity index, serious
   * adverse-event rate) from one representative completed trial at this
   * facility — already fetched for the live KPI overrides below, exposed
   * here as-is so runPipeline.ts can pass it into buildLiveRiskRecords for
   * the Adverse Events risk category, instead of re-fetching. null if no
   * facility trial has posted results, or if LLM isn't configured (in which
   * case this field is never fetched at all — see the early-return below).
   */
  resultsSignal: FacilityResultsSignal | null;
  /** Deterministic SYNTHETIC per-site cost figure — see data/syntheticSiteCost.ts for why no live/LLM source exists for this. */
  siteCost: SyntheticSiteCost;
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
  const maxSites = params.maxSites ?? 40;

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
          // Not fetched in this branch (see the comment below on why
          // getFacilityResultsSignal is skipped when the site won't be
          // scored anyway) — the Adverse Events risk category will show as
          // no-signal for this site rather than fetching just for it.
          resultsSignal: null,
          siteCost,
        };
      }

      // Real KPI signal, computed only once we know this site will actually
      // be scored (LLM configured) — avoids a wasted extra API call
      // (getFacilityResultsSignal) for sites that would just get evalRow:
      // null and never use it anyway.
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
