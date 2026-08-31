import { config } from "../config.js";

const BASE_URL = "https://clinicaltrials.gov/api/v2";

(async () => {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (!proxyUrl) return;
  try {
    const undiciModuleName = "undici";
    const undici: {
      setGlobalDispatcher: (dispatcher: unknown) => void;
      ProxyAgent: new (url: string) => unknown;
    } = await import(undiciModuleName);
    undici.setGlobalDispatcher(new undici.ProxyAgent(proxyUrl));
    console.log(
      `[ctgov] Routing ClinicalTrials.gov requests through proxy ${proxyUrl}`,
    );
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
  if (e?.cause) {
    console.warn(`[ctgov] ${label}: ${e.message}`, "— cause:", e.cause);
  } else {
    console.warn(`[ctgov] ${label}:`, e?.message ?? err);
  }
}


export async function getActiveCompetingTrialsCount(
  condition: string,
  country: string,
): Promise<number | null> {
  if (!config.ctgov.enabled) return null;
  const statuses = config.competingTrials.statuses;
  const cacheKey = `competing:${condition.toLowerCase()}|${country.toLowerCase()}|${statuses.join(",")}`;
  const cached = getCached<number>(cacheKey);
  if (cached !== undefined) return cached;

  let url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&filter.overallStatus=${encodeURIComponent(statuses.join(","))}` +
    `&countTotal=true&pageSize=1`;
  if (country) url += `&query.locn=${encodeURIComponent(country)}`;

  try {
    const json = await fetchJson<{ totalCount?: number }>(
      url,
      config.ctgov.timeoutMs,
    );
    const count = typeof json.totalCount === "number" ? json.totalCount : null;
    if (count !== null) setCached(cacheKey, count, config.ctgov.cacheTtlMs);
    return count;
  } catch (err) {
    warn(
      `competing-trials lookup failed for "${condition}" / "${country}"`,
      err,
    );
    return null;
  }
}

export interface EligibilityCriteriaSample {
  sourceNctId: string;
  sourceBriefTitle: string | null;
  eligibilityCriteriaText: string | null;
  sex: string | null;
  minimumAge: string | null;
  maximumAge: string | null;
  healthyVolunteers: boolean | null;
}

interface EligibilityStudiesResponse {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: { nctId?: string; briefTitle?: string };
      eligibilityModule?: {
        eligibilityCriteria?: string;
        sex?: string;
        minimumAge?: string;
        maximumAge?: string;
        healthyVolunteers?: boolean;
      };
    };
  }>;
}

export async function getEligibilityCriteriaSample(
  condition: string,
): Promise<EligibilityCriteriaSample | null> {
  if (!config.ctgov.enabled) return null;
  const cacheKey = `eligibility-sample:${condition.toLowerCase()}`;
  const cached = getCached<EligibilityCriteriaSample | null>(cacheKey);
  if (cached !== undefined) return cached;

  const fields = [
    "NCTId",
    "BriefTitle",
    "EligibilityCriteria",
    "Sex",
    "MinimumAge",
    "MaximumAge",
    "HealthyVolunteers",
  ].join(",");
  const recruitingUrl =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&filter.overallStatus=RECRUITING&fields=${fields}&pageSize=1`;
  const anyStatusUrl =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&fields=${fields}&pageSize=1`;

  try {
    let json = await fetchJson<EligibilityStudiesResponse>(
      recruitingUrl,
      config.ctgov.timeoutMs,
    );
    if (!json.studies || json.studies.length === 0) {
      json = await fetchJson<EligibilityStudiesResponse>(
        anyStatusUrl,
        config.ctgov.timeoutMs,
      );
    }
    const study = json.studies?.[0];
    if (!study) {
      setCached(cacheKey, null, config.ctgov.cacheTtlMs);
      return null;
    }
    const elig = study.protocolSection?.eligibilityModule;
    const result: EligibilityCriteriaSample = {
      sourceNctId: study.protocolSection?.identificationModule?.nctId ?? "",
      sourceBriefTitle:
        study.protocolSection?.identificationModule?.briefTitle ?? null,
      eligibilityCriteriaText: elig?.eligibilityCriteria ?? null,
      sex: elig?.sex ?? null,
      minimumAge: elig?.minimumAge ?? null,
      maximumAge: elig?.maximumAge ?? null,
      healthyVolunteers:
        typeof elig?.healthyVolunteers === "boolean"
          ? elig.healthyVolunteers
          : null,
    };
    setCached(cacheKey, result, config.ctgov.cacheTtlMs);
    return result;
  } catch (err) {
    warn(`eligibility-criteria lookup failed for "${condition}"`, err);
    return null;
  }
}

export interface LiveFacility {
  nctId: string;
  briefTitle: string | null;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
  lastUpdatePostDate: string | null;
}

interface StudiesResponse {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: { nctId?: string; briefTitle?: string };
      statusModule?: {
        overallStatus?: string;
        lastUpdatePostDateStruct?: { date?: string };
      };
      eligibilityModule?: {
        minimumAge?: string;
        maximumAge?: string;
      };
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

function selectedStdAgeValues(ageGroups: string[] | undefined): Set<string> {
  const values = new Set<string>();
  for (const g of ageGroups ?? []) {
    if (/older\s*adult/i.test(g)) values.add("OLDER_ADULT");
    else if (/^child/i.test(g)) values.add("CHILD");
    else if (/^adult/i.test(g)) values.add("ADULT");
  }
  return values;
}

const CHILD_UPPER_YEARS = 18;
const OLDER_ADULT_LOWER_YEARS = 65;

function parseAgeYears(age: string | null | undefined): number | null {
  if (!age) return null;
  const m = age.trim().match(/^(\d+(?:\.\d+)?)\s*(year|month|week|day)s?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case "year":
      return n;
    case "month":
      return n / 12;
    case "week":
      return n / 52;
    default:
      return n / 365;
  }
}

function studyAgeGroups(
  minimumAge: string | null | undefined,
  maximumAge: string | null | undefined,
): Set<string> {
  const minYears = parseAgeYears(minimumAge) ?? 0;
  const maxYears = parseAgeYears(maximumAge) ?? Infinity;
  const groups = new Set<string>();
  if (minYears < CHILD_UPPER_YEARS) groups.add("CHILD");
  if (maxYears >= CHILD_UPPER_YEARS && minYears < OLDER_ADULT_LOWER_YEARS) {
    groups.add("ADULT");
  }
  if (maxYears >= OLDER_ADULT_LOWER_YEARS) groups.add("OLDER_ADULT");
  return groups;
}

export async function getFacilitiesForCondition(
  condition: string,
  opts: {
    country?: string;
    pageSize?: number;
    ageGroups?: string[];
    statuses?: string[];
  } = {},
): Promise<LiveFacility[]> {
  if (!config.ctgov.enabled) return [];
  const pageSize = opts.pageSize ?? 30;
  const ageKey = (opts.ageGroups ?? []).slice().sort().join(",").toLowerCase();
  const statusKey = (opts.statuses ?? []).slice().sort().join(",").toUpperCase();
  const cacheKey = `facilities:${condition.toLowerCase()}|${(opts.country ?? "").toLowerCase()}|${pageSize}|${ageKey}|${statusKey}`;
  const cached = getCached<LiveFacility[]>(cacheKey);
  if (cached !== undefined) return cached;

  const fields = [
    "NCTId",
    "BriefTitle",
    "OverallStatus",
    "LastUpdatePostDate",
    "MinimumAge",
    "MaximumAge",
    "LocationFacility",
    "LocationCity",
    "LocationState",
    "LocationCountry",
    "LocationStatus",
  ].join(",");

  const url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&fields=${fields}&pageSize=${pageSize}` +
    (opts.country ? `&query.locn=${encodeURIComponent(opts.country)}` : "") +
    (opts.statuses && opts.statuses.length > 0
      ? `&filter.overallStatus=${encodeURIComponent(opts.statuses.join(","))}`
      : "");

  const selectedAges = selectedStdAgeValues(opts.ageGroups);

  try {
    const json = await fetchJson<StudiesResponse>(url, config.ctgov.timeoutMs);
    const facilities: LiveFacility[] = [];
    for (const study of json.studies ?? []) {
      if (selectedAges.size > 0) {
        const groups = studyAgeGroups(
          study.protocolSection?.eligibilityModule?.minimumAge,
          study.protocolSection?.eligibilityModule?.maximumAge,
        );
        const overlaps = [...selectedAges].some((g) => groups.has(g));
        if (!overlaps) continue;
      }
      const nctId = study.protocolSection?.identificationModule?.nctId ?? "";
      const briefTitle =
        study.protocolSection?.identificationModule?.briefTitle ?? null;
      const overallStatus =
        study.protocolSection?.statusModule?.overallStatus ?? null;
      const lastUpdatePostDate =
        study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ??
        null;
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
          status: loc.status ?? overallStatus ?? null,
          lastUpdatePostDate,
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

export interface FacilityTrialRecord {
  nctId: string;
  briefTitle: string | null;
  overallStatus: string | null;
  whyStopped: string | null;
  hasResults: boolean | null;
  primaryCompletionDate: string | null;
  enrollmentCount: number | null;
  enrollmentType: string | null;
  designAllocation: string | null;
  designInterventionModel: string | null;
  designMasking: string | null;
  interventionTypes: string[];
  lastUpdatePostDate: string | null;
  statusVerifiedDate: string | null;
  startDate: string | null;
}

export interface FacilityHistory {
  facility: string;
  city: string | null;
  state: string | null;
  country: string | null;
  trials: FacilityTrialRecord[];
}

interface RawHistoryStudy {
  hasResults?: boolean;
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: {
      overallStatus?: string;
      whyStopped?: string;
      primaryCompletionDateStruct?: { date?: string };
      lastUpdatePostDateStruct?: { date?: string };
      statusVerifiedDate?: string;
      startDateStruct?: { date?: string };
    };
    designModule?: {
      enrollmentInfo?: { count?: number; type?: string };
      designInfo?: {
        allocation?: string;
        interventionModel?: string;
        maskingInfo?: { masking?: string };
      };
    };
    armsInterventionsModule?: {
      interventions?: Array<{ type?: string }>;
    };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        state?: string;
        country?: string;
      }>;
    };
  };
}

interface HistoryStudiesResponse {
  studies?: RawHistoryStudy[];
}

const HISTORY_FIELDS = [
  "NCTId",
  "BriefTitle",
  "OverallStatus",
  "WhyStopped",
  "HasResults",
  "PrimaryCompletionDate",
  "EnrollmentCount",
  "EnrollmentType",
  "DesignAllocation",
  "DesignInterventionModel",
  "DesignMasking",
  "InterventionType",
  "LastUpdatePostDate",
  "StatusVerifiedDate",
  "StartDate",
  "LocationFacility",
  "LocationCity",
  "LocationState",
  "LocationCountry",
].join(",");

function trialRecordFrom(study: RawHistoryStudy): FacilityTrialRecord {
  return {
    nctId: study.protocolSection?.identificationModule?.nctId ?? "",
    briefTitle: study.protocolSection?.identificationModule?.briefTitle ?? null,
    overallStatus: study.protocolSection?.statusModule?.overallStatus ?? null,
    whyStopped: study.protocolSection?.statusModule?.whyStopped ?? null,
    hasResults: typeof study.hasResults === "boolean" ? study.hasResults : null,
    primaryCompletionDate:
      study.protocolSection?.statusModule?.primaryCompletionDateStruct?.date ??
      null,
    enrollmentCount:
      typeof study.protocolSection?.designModule?.enrollmentInfo?.count ===
      "number"
        ? (study.protocolSection.designModule.enrollmentInfo.count as number)
        : null,
    enrollmentType:
      study.protocolSection?.designModule?.enrollmentInfo?.type ?? null,
    designAllocation:
      study.protocolSection?.designModule?.designInfo?.allocation ?? null,
    designInterventionModel:
      study.protocolSection?.designModule?.designInfo?.interventionModel ??
      null,
    designMasking:
      study.protocolSection?.designModule?.designInfo?.maskingInfo?.masking ??
      null,
    interventionTypes: (
      study.protocolSection?.armsInterventionsModule?.interventions ?? []
    )
      .map((i) => i.type)
      .filter((t): t is string => !!t),
    lastUpdatePostDate:
      study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ??
      null,
    statusVerifiedDate:
      study.protocolSection?.statusModule?.statusVerifiedDate ?? null,
    startDate: study.protocolSection?.statusModule?.startDateStruct?.date ?? null,
  };
}

export async function getFacilityHistories(
  condition: string,
  opts: { country?: string; pageSize?: number } = {},
): Promise<Map<string, FacilityHistory>> {
  if (!config.ctgov.enabled) return new Map();
  const pageSize = opts.pageSize ?? 60;
  const cacheKey = `facility-history:${condition.toLowerCase()}|${(opts.country ?? "").toLowerCase()}|${pageSize}`;
  const cached = getCached<Map<string, FacilityHistory>>(cacheKey);
  if (cached !== undefined) return cached;

  let url =
    `${BASE_URL}/studies?query.cond=${encodeURIComponent(condition)}` +
    `&fields=${HISTORY_FIELDS}&pageSize=${pageSize}`;
  if (opts.country) url += `&query.locn=${encodeURIComponent(opts.country)}`;

  try {
    const json = await fetchJson<HistoryStudiesResponse>(
      url,
      config.ctgov.timeoutMs,
    );
    const map = new Map<string, FacilityHistory>();
    for (const study of json.studies ?? []) {
      const record = trialRecordFrom(study);
      const locations =
        study.protocolSection?.contactsLocationsModule?.locations ?? [];
      for (const loc of locations) {
        if (!loc.facility) continue;
        if (!locationMatchesCountry(loc.country, opts.country)) continue;
        const key =
          `${loc.facility}|${loc.city ?? ""}|${loc.country ?? ""}`.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            facility: loc.facility,
            city: loc.city ?? null,
            state: loc.state ?? null,
            country: loc.country ?? null,
            trials: [],
          });
        }
        map.get(key)!.trials.push(record);
      }
    }
    setCached(cacheKey, map, config.ctgov.cacheTtlMs);
    return map;
  } catch (err) {
    warn(`facility-history lookup failed for "${condition}"`, err);
    return new Map();
  }
}

export async function getFacilityWideHistory(
  facility: string,
  city: string | null,
  country: string | null,
): Promise<FacilityHistory | null> {
  if (!config.ctgov.enabled || !facility) return null;
  const cacheKey = `facility-wide:${facility.toLowerCase()}|${(city ?? "").toLowerCase()}|${(country ?? "").toLowerCase()}`;
  const cached = getCached<FacilityHistory | null>(cacheKey);
  if (cached !== undefined) return cached;

  const url =
    `${BASE_URL}/studies?query.locn=${encodeURIComponent(facility)}` +
    `&fields=${HISTORY_FIELDS}&pageSize=100`;

  try {
    const json = await fetchJson<HistoryStudiesResponse>(
      url,
      config.ctgov.timeoutMs,
    );
    const cityKey = (city ?? "").trim().toLowerCase();
    const facilityKey = facility.trim().toLowerCase();
    const trials: FacilityTrialRecord[] = [];
    for (const study of json.studies ?? []) {
      const locations =
        study.protocolSection?.contactsLocationsModule?.locations ?? [];
      const matches = locations.some((loc) => {
        if (!loc.facility) return false;
        if (loc.facility.trim().toLowerCase() !== facilityKey) return false;
        if (cityKey && (loc.city ?? "").trim().toLowerCase() !== cityKey) {
          return false;
        }
        if (!locationMatchesCountry(loc.country, country ?? undefined)) {
          return false;
        }
        return true;
      });
      if (!matches) continue;
      trials.push(trialRecordFrom(study));
    }
    if (trials.length === 0) {
      setCached(cacheKey, null, config.ctgov.cacheTtlMs);
      return null;
    }
    const result: FacilityHistory = { facility, city, state: null, country, trials };
    setCached(cacheKey, result, config.ctgov.cacheTtlMs);
    return result;
  } catch (err) {
    warn(`facility-wide history lookup failed for "${facility}"`, err);
    return null;
  }
}

export interface RaceBreakdownEntry {
  category: string;
  percent: number;
}

export interface FacilityResultsSignal {
  dropoutRatePercent: number | null;
  diversityIndex: number | null;
  raceBreakdown: RaceBreakdownEntry[] | null;
  seriousAdverseEventRatePercent: number | null;
  sourceNctId: string;
}

interface FlowAchievement {
  groupId?: string;
  numSubjects?: string;
}
interface FlowMilestone {
  type?: string;
  achievements?: FlowAchievement[];
}
interface FlowPeriod {
  title?: string;
  milestones?: FlowMilestone[];
}
interface BaselineMeasurement {
  groupId?: string;
  value?: string;
}
interface BaselineCategory {
  title?: string;
  measurements?: BaselineMeasurement[];
}
interface BaselineClass {
  categories?: BaselineCategory[];
}
interface BaselineMeasure {
  title?: string;
  classes?: BaselineClass[];
}
interface AdverseEventGroup {
  id?: string;
  title?: string;
  seriousNumAffected?: number;
  seriousNumAtRisk?: number;
}
interface StudyResultsResponse {
  resultsSection?: {
    participantFlowModule?: { periods?: FlowPeriod[] };
    baselineCharacteristicsModule?: { measures?: BaselineMeasure[] };
    adverseEventsModule?: { eventGroups?: AdverseEventGroup[] };
  };
}

function sumMilestone(period: FlowPeriod, type: string): number | null {
  const milestone = period.milestones?.find(
    (m) => (m.type ?? "").toUpperCase() === type,
  );
  if (!milestone?.achievements?.length) return null;
  let total = 0;
  let any = false;
  for (const a of milestone.achievements) {
    const n = Number(a.numSubjects);
    if (Number.isFinite(n)) {
      total += n;
      any = true;
    }
  }
  return any ? total : null;
}

interface RaceDiversityResult {
  index: number | null;
  breakdown: RaceBreakdownEntry[] | null;
}

function raceDiversityIndex(
  measures: BaselineMeasure[] | undefined,
): RaceDiversityResult {
  const raceMeasure = (measures ?? []).find((m) =>
    /race|ethnicity/i.test(m.title ?? ""),
  );
  if (!raceMeasure) return { index: null, breakdown: null };
  const entries: { category: string; total: number }[] = [];
  for (const cls of raceMeasure.classes ?? []) {
    for (const cat of cls.categories ?? []) {
      let catTotal = 0;
      let any = false;
      for (const m of cat.measurements ?? []) {
        const n = Number(m.value);
        if (Number.isFinite(n)) {
          catTotal += n;
          any = true;
        }
      }
      if (any) entries.push({ category: cat.title ?? "Unspecified", total: catTotal });
    }
  }
  const grandTotal = entries.reduce((a, b) => a + b.total, 0);
  if (grandTotal <= 0 || entries.length < 2) return { index: null, breakdown: null };
  const sumSquares = entries.reduce(
    (sum, e) => sum + Math.pow(e.total / grandTotal, 2),
    0,
  );
  const index = Math.round((1 - sumSquares) * 1000) / 10;
  const breakdown: RaceBreakdownEntry[] = entries
    .map((e) => ({
      category: e.category,
      percent: Math.round((e.total / grandTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.percent - a.percent);
  return { index, breakdown };
}

export async function getFacilityResultsSignal(
  nctId: string,
): Promise<FacilityResultsSignal | null> {
  if (!config.ctgov.enabled || !nctId) return null;
  const cacheKey = `results-signal:${nctId.toUpperCase()}`;
  const cached = getCached<FacilityResultsSignal | null>(cacheKey);
  if (cached !== undefined) return cached;

  const fields = [
    "resultsSection.participantFlowModule",
    "resultsSection.baselineCharacteristicsModule",
    "resultsSection.adverseEventsModule.eventGroups",
  ].join(",");
  const url = `${BASE_URL}/studies/${encodeURIComponent(nctId)}?fields=${fields}`;

  try {
    const json = await fetchJson<StudyResultsResponse>(url, config.ctgov.timeoutMs);
    const periods = json.resultsSection?.participantFlowModule?.periods ?? [];
    let dropoutRatePercent: number | null = null;
    for (const period of periods) {
      const started = sumMilestone(period, "STARTED");
      const completed = sumMilestone(period, "COMPLETED");
      if (started !== null && started > 0 && completed !== null) {
        dropoutRatePercent =
          Math.round(((started - completed) / started) * 1000) / 10;
        break;
      }
    }
    const { index: diversityIndex, breakdown: raceBreakdown } = raceDiversityIndex(
      json.resultsSection?.baselineCharacteristicsModule?.measures,
    );
    const seriousAdverseEventRatePercent = seriousAdverseEventRateFrom(
      json.resultsSection?.adverseEventsModule?.eventGroups,
    );
    if (
      dropoutRatePercent === null &&
      diversityIndex === null &&
      seriousAdverseEventRatePercent === null
    ) {
      setCached(cacheKey, null, config.ctgov.cacheTtlMs);
      return null;
    }
    const result: FacilityResultsSignal = {
      dropoutRatePercent,
      diversityIndex,
      raceBreakdown,
      seriousAdverseEventRatePercent,
      sourceNctId: nctId,
    };
    setCached(cacheKey, result, config.ctgov.cacheTtlMs);
    return result;
  } catch (err) {
    warn(`results-signal lookup failed for "${nctId}"`, err);
    return null;
  }
}

function seriousAdverseEventRateFrom(
  eventGroups: AdverseEventGroup[] | undefined,
): number | null {
  if (!eventGroups || eventGroups.length === 0) return null;
  let affected = 0;
  let atRisk = 0;
  let any = false;
  for (const g of eventGroups) {
    if (typeof g.seriousNumAffected === "number") {
      affected += g.seriousNumAffected;
      any = true;
    }
    if (typeof g.seriousNumAtRisk === "number") {
      atRisk += g.seriousNumAtRisk;
    }
  }
  if (!any || atRisk <= 0) return null;
  return Math.round((affected / atRisk) * 1000) / 10;
}

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

  const fields = [
    "NCTId",
    "Phase",
    "EnrollmentCount",
    "StartDate",
    "PrimaryCompletionDate",
  ].join(",");
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

export interface FieldTopValue {
  value: string;
  count: number;
}

interface FieldValuesResponse {
  topValues?: Array<{ value?: string; count?: number }>;
  uniqueValuesCount?: number;
}

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
