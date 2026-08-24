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
    // Carry the real category-by-category breakdown along too, not just
    // the collapsed index — lets the UI show the actual race/ethnicity
    // ratio instead of only a single 0-100 number.
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

export const RECRUITING_LOCATION_STATUSES = new Set([
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

/**
 * The three statuses the Risk Register / Ranking status filter actually
 * offers (see RiskAssessmentPanel.tsx / SiteRankingPanel.tsx) — kept as a
 * local copy per this codebase's existing per-component convention.
 */
const CANDIDATE_STATUS_TIERS = [
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ACTIVE_NOT_RECRUITING",
];

/**
 * Picks up to maxSites facilities, split as evenly as possible across
 * RECRUITING / NOT_YET_RECRUITING / ACTIVE_NOT_RECRUITING (round-robin, one
 * from each tier in turn) rather than taking whichever status happens to
 * fill up first. A strict "best status wins" ordering was tried first and
 * overshot: when a condition/country combo has 40+ real RECRUITING
 * facilities, taking the single highest-priority status first fills every
 * slot with RECRUITING and leaves NONE of the other two statuses
 * represented at all — which defeats the point of a 3-way status filter
 * that a user can actually switch between. Round-robin instead guarantees
 * every status with real data gets a fair share of the limited slots
 * (falling back to whatever's left once a tier runs dry). A status outside
 * these three (e.g. ENROLLING_BY_INVITATION, still fetched because it's in
 * config.competingTrials.statuses) is deprioritized last since none of the
 * three UI filter options can ever surface it.
 */
function selectBalancedByStatus(
  facilities: LiveFacility[],
  maxSites: number,
): LiveFacility[] {
  const realBuckets = CANDIDATE_STATUS_TIERS.map((tier) =>
    facilities.filter((f) => (f.status ?? "").toUpperCase() === tier),
  );
  // Anything outside the three real tiers (ENROLLING_BY_INVITATION,
  // COMPLETED, TERMINATED, WITHDRAWN, SUSPENDED, unrecognized/null) — none
  // of these are selectable in Risk Register/Ranking's own status filter
  // (RiskAssessmentPanel.tsx / SiteRankingPanel.tsx only offer Recruiting /
  // Not Yet Recruiting / Active Not Recruiting), so a site landing here is
  // effectively invisible once analyzed. Kept separate from the round-robin
  // below (previously round-robinned as an equal 4th bucket, which meant up
  // to 1/4 of the maxSites budget silently went to sites the UI could never
  // filter to — e.g. 10 of a 40-site cap, matching only the 3 real tiers'
  // ~10 each).
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
  // Only once the three real, filterable tiers are exhausted (not enough
  // real-status facilities to reach maxSites) do we fall back to filling
  // remaining slots from `otherBucket` — real, currently-relevant statuses
  // get full priority for the limited budget.
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
  /** Cap on how many real facilities to pull/estimate per run — each one costs an LLM call. */
  maxSites?: number;
  /** Trial form's selected Age Group label(s) — see services/ctgov.client.ts's studyAgeGroups and data/ageDemographics.ts. Empty/absent = all ages, no filtering. */
  ageGroups?: string[];
  /**
   * Real ClinicalTrials.gov facility rows the caller already has on hand —
   * e.g. exactly the sites a user reviewed on the Ongoing Trials tab
   * (GET /api/live-trials), forwarded here so Risk Register/Ranking analyze
   * THAT set instead of this function silently re-querying ClinicalTrials.gov
   * on its own and potentially landing on a different list of sites. When
   * omitted/empty, falls back to the original behavior of fetching the pool
   * itself (used by the one-shot /api/run flow, which has no prior Ongoing
   * Trials selection to reuse).
   */
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
          // Fetch a substantially larger raw pool than we'll actually keep
          // (maxSites, after dedupe+balanced-status-selection below) — a small
          // multiplier here meant a page dominated by one status could exhaust
          // itself before ever reaching enough of another status to keep the
          // 3-way filter balanced.
          pageSize: Math.max(maxSites * 6, 200),
          // Real filter: only sites from trials whose disclosed StdAge eligibility
          // includes the selected group(s) — same mechanism as the Site Map tab
          // (pipeline/liveMapData.ts). Left OFF the competing-pool fetch further
          // below (deliberately): "how many other trials compete for the same
          // pool of staff/patients here" is still a meaningful signal even when
          // those competing trials have a different age scope than THIS trial.
          ageGroups: params.ageGroups,
          // Restrict the raw pull itself to live/active statuses (Risk Register
          // and Ranking only ever show Recruiting / Active Not Recruiting sites —
          // see RiskAssessmentPanel.tsx / SiteRankingPanel.tsx). Without this, the
          // fixed-size page above can fill up with Completed/Terminated studies
          // before ever reaching a Recruiting one, so a trial that's clearly
          // Recruiting on the Ongoing Trials tab could otherwise never make it
          // into the candidate pool here at all.
          statuses: config.competingTrials.statuses,
        });
  // Split the limited maxSites slots as evenly as possible across
  // RECRUITING / NOT_YET_RECRUITING / ACTIVE_NOT_RECRUITING — see
  // selectBalancedByStatus's doc comment for why a strict "best status
  // wins" ordering isn't used here. Applies even when `params.facilities`
  // was supplied directly (e.g. from the Ongoing Trials tab) — maxSites is
  // still a real cost cap (one LLM call per site), so a caller-provided list
  // larger than that cap is balanced/trimmed the same way a self-fetched
  // pool would be, not silently truncated from one end.
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
