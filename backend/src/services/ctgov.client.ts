/**
 * Thin client for the public ClinicalTrials.gov v2 API
 * (https://clinicaltrials.gov/data-api/api). No API key required.
 *
 * Every call here is best-effort: on any failure (network, timeout, bad
 * response) the function resolves to `null` / an empty result rather than
 * throwing, so callers can fall back to the existing Excel-derived value
 * without the request that triggered them failing outright.
 *
 * Requires Node 18+ (global `fetch`).
 */
import { config } from "../config.js";

const BASE_URL = "https://clinicaltrials.gov/api/v2";

/**
 * Corporate-network support: Node's built-in `fetch` does NOT read
 * HTTP_PROXY / HTTPS_PROXY env vars on its own — if your machine requires a
 * proxy for outbound internet access (common on a corporate laptop), fetch
 * calls fail with a generic "fetch failed" / DNS or connection error even
 * though a browser on the same machine works fine. This block detects a
 * proxy env var and routes fetch through it via undici's ProxyAgent, if the
 * `undici` package is installed (`npm install undici` in backend/).
 * Safe no-op if no proxy env var is set or the package isn't installed.
 */
(async () => {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (!proxyUrl) return;
  try {
    const undici = await import("undici");
    undici.setGlobalDispatcher(new undici.ProxyAgent(proxyUrl));
    console.log(`[ctgov] Routing ClinicalTrials.gov requests through proxy ${proxyUrl}`);
  } catch {
    console.warn(
      "[ctgov] HTTPS_PROXY/HTTP_PROXY is set but the 'undici' package isn't installed, " +
        "so fetch calls are NOT going through your proxy. Run `npm install undici` in backend/ " +
        "if clinicaltrials.gov calls keep failing on this network.",
    );
  }
})();

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * ClinicalTrials.gov's `query.locn` filters at the STUDY level — a study
 * matches if ANY of its locations are in that country — but the API still
 * returns EVERY location for that study, worldwide. A global multi-country
 * trial with one site in India also brings back its US/EU/etc. sites if you
 * don't filter the locations array yourself. This does that client-side
 * filter so "candidate sites for India" never silently includes a site in
 * California.
 */
function locationMatchesCountry(
  locCountry: string | null | undefined,
  targetCountry: string | undefined,
): boolean {
  if (!targetCountry) return true;
  if (!locCountry) return false;
  const a = locCountry.trim().toLowerCase();
  const b = targetCountry.trim().toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`ClinicalTrials.gov responded ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function warn(label: string, err: unknown): void {
  const e = err as Error & { cause?: unknown };
  // `fetch failed` is undici's generic wrapper message — the real reason
  // (DNS failure, connection refused, TLS error, proxy rejection, timeout)
  // is in `.cause`. Log both so the actual root cause is visible.
  if (e?.cause) {
    console.warn(`[ctgov] ${label}: ${e.message}`, "— cause:", e.cause);
  } else {
    console.warn(`[ctgov] ${label}:`, e?.message ?? err);
  }
}

/* ---------------------------------------------------------------------- */
/* 1. Active competing trials count                                       */
/* ---------------------------------------------------------------------- */

/**
 * Live replacement for RegionRow["Active Competing Trials"].
 * GET /studies?query.cond={condition}&query.locn={country}
 *     &filter.overallStatus=RECRUITING,NOT_YET_RECRUITING&countTotal=true&pageSize=1
 */
export async function getActiveCompetingTrialsCount(
  condition: string,
  country: string,
): Promise<number | null> {
  if (!config.ctgov.enabled) return null;
  const cacheKey = `competing:${condition.toLowerCase()}|${country.toLowerCase()}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== undefined) return cached;

  const url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&query.locn=${encodeURIComponent(country)}` +
    `&filter.overallStatus=RECRUITING,NOT_YET_RECRUITING` +
    `&countTotal=true&pageSize=1`;

  try {
    const json = await fetchJson<{ totalCount?: number }>(
      url,
      config.ctgov.timeoutMs,
    );
    const count = typeof json.totalCount === "number" ? json.totalCount : null;
    if (count !== null) setCached(cacheKey, count, config.ctgov.cacheTtlMs);
    return count;
  } catch (err) {
    warn(`competing-trials lookup failed for "${condition}" / "${country}"`, err);
    return null;
  }
}

/* ---------------------------------------------------------------------- */
/* 2. Real facilities running trials in a condition (cross-check list)    */
/* ---------------------------------------------------------------------- */

export interface LiveFacility {
  nctId: string;
  briefTitle: string | null;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
}

interface StudiesResponse {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: { nctId?: string; briefTitle?: string };
      contactsLocationsModule?: {
        locations?: Array<{
          facility?: string;
          city?: string;
          state?: string;
          country?: string;
          status?: string;
        }>;
      };
    };
  }>;
  totalCount?: number;
}

/**
 * Live cross-check for SiteRow — real facilities ClinicalTrials.gov has
 * on record as running (or having run) trials for this condition.
 * GET /studies?query.cond={condition}[&query.locn={country}]
 *     &fields=NCTId,BriefTitle,LocationFacility,LocationCity,LocationState,LocationCountry,LocationStatus
 */
export async function getFacilitiesForCondition(
  condition: string,
  opts: { country?: string; pageSize?: number } = {},
): Promise<LiveFacility[]> {
  if (!config.ctgov.enabled) return [];
  const pageSize = opts.pageSize ?? 30;
  const cacheKey = `facilities:${condition.toLowerCase()}|${(opts.country ?? "").toLowerCase()}|${pageSize}`;
  const cached = getCached<LiveFacility[]>(cacheKey);
  if (cached !== undefined) return cached;

  const fields = [
    "NCTId",
    "BriefTitle",
    "LocationFacility",
    "LocationCity",
    "LocationState",
    "LocationCountry",
    "LocationStatus",
  ].join(",");

  let url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&fields=${fields}&pageSize=${pageSize}`;
  if (opts.country) url += `&query.locn=${encodeURIComponent(opts.country)}`;

  try {
    const json = await fetchJson<StudiesResponse>(url, config.ctgov.timeoutMs);
    const facilities: LiveFacility[] = [];
    for (const study of json.studies ?? []) {
      const nctId = study.protocolSection?.identificationModule?.nctId ?? "";
      const briefTitle =
        study.protocolSection?.identificationModule?.briefTitle ?? null;
      const locations =
        study.protocolSection?.contactsLocationsModule?.locations ?? [];
      for (const loc of locations) {
        if (!locationMatchesCountry(loc.country, opts.country)) continue;
        facilities.push({
          nctId,
          briefTitle,
          facility: loc.facility ?? null,
          city: loc.city ?? null,
          state: loc.state ?? null,
          country: loc.country ?? null,
          status: loc.status ?? null,
        });
      }
    }
    setCached(cacheKey, facilities, config.ctgov.cacheTtlMs);
    return facilities;
  } catch (err) {
    warn(`facility lookup failed for "${condition}"`, err);
    return [];
  }
}

/* ---------------------------------------------------------------------- */
/* 2b. Real per-facility trial-status history (for risk assessment)       */
/* ---------------------------------------------------------------------- */

export interface FacilityTrialRecord {
  nctId: string;
  briefTitle: string | null;
  /** RECRUITING, COMPLETED, TERMINATED, WITHDRAWN, SUSPENDED, etc. */
  overallStatus: string | null;
  /** Sponsor-disclosed reason, present mainly on TERMINATED/WITHDRAWN/SUSPENDED trials. */
  whyStopped: string | null;
}

export interface FacilityHistory {
  facility: string;
  city: string | null;
  state: string | null;
  country: string | null;
  trials: FacilityTrialRecord[];
}

interface HistoryStudiesResponse {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: { nctId?: string; briefTitle?: string };
      statusModule?: { overallStatus?: string; whyStopped?: string };
      contactsLocationsModule?: {
        locations?: Array<{
          facility?: string;
          city?: string;
          state?: string;
          country?: string;
        }>;
      };
    };
  }>;
}

/**
 * Real, factual risk signal — deliberately does NOT filter by overallStatus,
 * so it captures TERMINATED/WITHDRAWN/SUSPENDED trials at a facility, not
 * just currently-recruiting ones. This is the only live, non-estimated
 * source of per-site risk signal: a facility whose trials were terminated
 * (with a disclosed reason) is a real, disclosed fact, not a guess.
 * GET /studies?query.cond={condition}[&query.locn={country}]
 *     &fields=NCTId,BriefTitle,OverallStatus,WhyStopped,LocationFacility,LocationCity,LocationState,LocationCountry
 */
export async function getFacilityHistories(
  condition: string,
  opts: { country?: string; pageSize?: number } = {},
): Promise<Map<string, FacilityHistory>> {
  if (!config.ctgov.enabled) return new Map();
  const pageSize = opts.pageSize ?? 60;
  const cacheKey = `facility-history:${condition.toLowerCase()}|${(opts.country ?? "").toLowerCase()}|${pageSize}`;
  const cached = getCached<Map<string, FacilityHistory>>(cacheKey);
  if (cached !== undefined) return cached;

  const fields = [
    "NCTId",
    "BriefTitle",
    "OverallStatus",
    "WhyStopped",
    "LocationFacility",
    "LocationCity",
    "LocationState",
    "LocationCountry",
  ].join(",");

  let url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&fields=${fields}&pageSize=${pageSize}`;
  if (opts.country) url += `&query.locn=${encodeURIComponent(opts.country)}`;

  try {
    const json = await fetchJson<HistoryStudiesResponse>(
      url,
      config.ctgov.timeoutMs,
    );
    const map = new Map<string, FacilityHistory>();
    for (const study of json.studies ?? []) {
      const nctId = study.protocolSection?.identificationModule?.nctId ?? "";
      const briefTitle =
        study.protocolSection?.identificationModule?.briefTitle ?? null;
      const overallStatus = study.protocolSection?.statusModule?.overallStatus ?? null;
      const whyStopped = study.protocolSection?.statusModule?.whyStopped ?? null;
      const locations =
        study.protocolSection?.contactsLocationsModule?.locations ?? [];
      for (const loc of locations) {
        if (!loc.facility) continue;
        if (!locationMatchesCountry(loc.country, opts.country)) continue;
        const key = `${loc.facility}|${loc.city ?? ""}|${loc.country ?? ""}`.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            facility: loc.facility,
            city: loc.city ?? null,
            state: loc.state ?? null,
            country: loc.country ?? null,
            trials: [],
          });
        }
        map.get(key)!.trials.push({ nctId, briefTitle, overallStatus, whyStopped });
      }
    }
    setCached(cacheKey, map, config.ctgov.cacheTtlMs);
    return map;
  } catch (err) {
    warn(`facility-history lookup failed for "${condition}"`, err);
    return new Map();
  }
}

/* ---------------------------------------------------------------------- */
/* 3. Completed-trial benchmarks (phase / sample size / duration)         */
/* ---------------------------------------------------------------------- */

export interface TrialBenchmark {
  sampleCount: number;
  phaseDistribution: Record<string, number>;
  medianSampleSize: number | null;
  medianDurationMonths: number | null;
  medianEnrollmentRatePerMonth: number | null;
}

interface CompletedStudiesResponse {
  studies?: Array<{
    protocolSection?: {
      designModule?: {
        phases?: string[];
        enrollmentInfo?: { count?: number };
      };
      statusModule?: {
        startDateStruct?: { date?: string };
        primaryCompletionDateStruct?: { date?: string };
      };
    };
  }>;
}

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
  return months >= 0 ? months : null;
}

/**
 * Live replacement/benchmark for the synthetic duration formula in
 * buildDataSet.ts — real phase mix, sample size and start→primary-completion
 * duration, diffed across completed trials for this condition.
 * GET /studies?query.cond={condition}&filter.overallStatus=COMPLETED
 *     &fields=NCTId,Phase,EnrollmentCount,StartDate,PrimaryCompletionDate
 */
export async function getCompletedTrialBenchmarks(
  condition: string,
  pageSize = 50,
): Promise<TrialBenchmark> {
  const empty: TrialBenchmark = {
    sampleCount: 0,
    phaseDistribution: {},
    medianSampleSize: null,
    medianDurationMonths: null,
    medianEnrollmentRatePerMonth: null,
  };
  if (!config.ctgov.enabled) return empty;

  const cacheKey = `benchmarks:${condition.toLowerCase()}|${pageSize}`;
  const cached = getCached<TrialBenchmark>(cacheKey);
  if (cached !== undefined) return cached;

  const fields = ["NCTId", "Phase", "EnrollmentCount", "StartDate", "PrimaryCompletionDate"].join(",");
  const url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&filter.overallStatus=COMPLETED&fields=${fields}&pageSize=${pageSize}`;

  try {
    const json = await fetchJson<CompletedStudiesResponse>(
      url,
      config.ctgov.timeoutMs,
    );
    const studies = json.studies ?? [];
    const phaseDistribution: Record<string, number> = {};
    const sampleSizes: number[] = [];
    const durations: number[] = [];
    const enrollmentRates: number[] = [];

    for (const study of studies) {
      const design = study.protocolSection?.designModule;
      for (const phase of design?.phases ?? []) {
        phaseDistribution[phase] = (phaseDistribution[phase] ?? 0) + 1;
      }
      const count = design?.enrollmentInfo?.count;
      if (typeof count === "number") sampleSizes.push(count);

      const start = study.protocolSection?.statusModule?.startDateStruct?.date;
      const end =
        study.protocolSection?.statusModule?.primaryCompletionDateStruct?.date;
      let months: number | null = null;
      if (start && end) {
        months = monthsBetween(start, end);
        if (months !== null) durations.push(months);
      }

      if (typeof count === "number" && months !== null && months > 0) {
        enrollmentRates.push(count / months);
      }
    }

    const result: TrialBenchmark = {
      sampleCount: studies.length,
      phaseDistribution,
      medianSampleSize: median(sampleSizes),
      medianDurationMonths: median(durations),
      medianEnrollmentRatePerMonth: median(enrollmentRates),
    };
    setCached(cacheKey, result, config.ctgov.cacheTtlMs);
    return result;
  } catch (err) {
    warn(`benchmark lookup failed for "${condition}"`, err);
    return empty;
  }
}

/* ---------------------------------------------------------------------- */
/* 3b. Dropout-rate benchmark (from completed trials' participant flow)   */
/* ---------------------------------------------------------------------- */

export interface DropoutRateBenchmark {
  sampleCount: number;
  medianDropoutRatePercent: number | null;
}

interface ParticipantFlowStudiesResponse {
  studies?: Array<{
    resultsSection?: {
      participantFlowModule?: {
        periods?: Array<{
          milestones?: Array<{
            type?: string;
            achievements?: Array<{ groupId?: string; numSubjects?: string }>;
          }>;
        }>;
      };
    };
  }>;
}

function sumAchievements(
  achievements: Array<{ groupId?: string; numSubjects?: string }> | undefined,
): number {
  if (!achievements) return 0;
  return achievements.reduce((sum, a) => {
    const n = Number(a.numSubjects);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/**
 * Live dropout-rate benchmark, derived from completed trials' disclosed
 * participant-flow results (resultsSection.participantFlowModule) — a real,
 * reported figure, not an estimate. Per period, dropout % = (STARTED -
 * COMPLETED) / STARTED * 100, summed across all achievement groups for that
 * period; periods with zero summed STARTED are skipped (would divide by 0).
 * GET /studies?query.cond={condition}&filter.overallStatus=COMPLETED
 *     &aggFilters=results:with&pageSize={pageSize}
 * (No `fields` param — the full record is needed to reach resultsSection.)
 */
export async function getDropoutRateBenchmark(
  condition: string,
  pageSize = 20,
): Promise<{ sampleCount: number; medianDropoutRatePercent: number | null }> {
  const empty = { sampleCount: 0, medianDropoutRatePercent: null };
  if (!config.ctgov.enabled) return empty;

  const cacheKey = `dropout:${condition.toLowerCase()}|${pageSize}`;
  const cached = getCached<DropoutRateBenchmark>(cacheKey);
  if (cached !== undefined) return cached;

  const url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&filter.overallStatus=COMPLETED&aggFilters=results:with&pageSize=${pageSize}`;

  try {
    const json = await fetchJson<ParticipantFlowStudiesResponse>(
      url,
      config.ctgov.timeoutMs,
    );
    const studies = json.studies ?? [];
    const dropoutRates: number[] = [];

    for (const study of studies) {
      const periods =
        study.resultsSection?.participantFlowModule?.periods ?? [];
      for (const period of periods) {
        let started = 0;
        let completed = 0;
        for (const milestone of period.milestones ?? []) {
          const type = (milestone.type ?? "").toUpperCase();
          if (type === "STARTED") {
            started += sumAchievements(milestone.achievements);
          } else if (type === "COMPLETED") {
            completed += sumAchievements(milestone.achievements);
          }
        }
        if (started > 0) {
          dropoutRates.push(((started - completed) / started) * 100);
        }
      }
    }

    const result = {
      sampleCount: studies.length,
      medianDropoutRatePercent: median(dropoutRates),
    };
    setCached(cacheKey, result, config.ctgov.cacheTtlMs);
    return result;
  } catch (err) {
    warn(`dropout-rate benchmark lookup failed for "${condition}"`, err);
    return empty;
  }
}

/* ---------------------------------------------------------------------- */
/* 4. Field vocabulary (live indications / countries)                     */
/* ---------------------------------------------------------------------- */

export interface FieldTopValue {
  value: string;
  count: number;
}

interface FieldValuesResponse {
  topValues?: Array<{ value?: string; count?: number }>;
  uniqueValuesCount?: number;
}

/**
 * Live, ranked vocabulary — e.g. to supplement store.indications / store.regions.
 * GET /stats/field/values?fields={field}
 * NOTE: the v2 stats endpoint takes one field at a time; this helper fans out
 * over the requested fields and returns them keyed by field name.
 */
export async function getFieldTopValues(
  fields: string[],
): Promise<Record<string, FieldTopValue[]>> {
  const out: Record<string, FieldTopValue[]> = {};
  if (!config.ctgov.enabled) return out;

  await Promise.all(
    fields.map(async (field) => {
      const cacheKey = `field-values:${field}`;
      const cached = getCached<FieldTopValue[]>(cacheKey);
      if (cached !== undefined) {
        out[field] = cached;
        return;
      }
      const url = `${BASE_URL}/stats/field/values?fields=${encodeURIComponent(field)}`;
      try {
        const json = await fetchJson<FieldValuesResponse>(
          url,
          config.ctgov.timeoutMs,
        );
        const values: FieldTopValue[] = (json.topValues ?? [])
          .filter((v) => v.value !== undefined && v.count !== undefined)
          .map((v) => ({ value: v.value as string, count: v.count as number }));
        setCached(cacheKey, values, config.ctgov.cacheTtlMs);
        out[field] = values;
      } catch (err) {
        warn(`field-values lookup failed for "${field}"`, err);
        out[field] = [];
      }
    }),
  );

  return out;
}
