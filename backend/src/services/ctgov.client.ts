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
/* 0. Single study lookup by NCT ID (landing-page "Search by NCT Number")  */
/* ---------------------------------------------------------------------- */

export interface NctStudyLookup {
  nctId: string;
  briefTitle: string | null;
  officialTitle: string | null;
  /** First disclosed condition — used as the auto-filled Indication. */
  condition: string | null;
  /** Every disclosed condition (a study can list more than one). */
  conditions: string[];
  overallStatus: string | null;
  /** Raw ClinicalTrials.gov phase value(s), e.g. "PHASE2" — mapped to the app's "Phase II" label by the caller/controller. */
  phases: string[];
  enrollmentCount: number | null;
  enrollmentType: string | null;
  sex: string | null;
  minimumAge: string | null;
  maximumAge: string | null;
  healthyVolunteers: boolean | null;
  startDate: string | null;
  primaryCompletionDate: string | null;
  /** De-duplicated, disclosed location countries — shown as context only; NOT used to restrict the region/country search (this app's site-selection engine deliberately searches every configured region globally rather than assuming the best NEW site is wherever the original trial happened to run). */
  countries: string[];
  /** Total disclosed locations (all countries) on this study's record. */
  siteCount: number;
}

interface RawNctStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      primaryCompletionDateStruct?: { date?: string };
    };
    designModule?: {
      phases?: string[];
      enrollmentInfo?: { count?: number; type?: string };
    };
    conditionsModule?: { conditions?: string[] };
    eligibilityModule?: {
      sex?: string;
      minimumAge?: string;
      maximumAge?: string;
      healthyVolunteers?: boolean;
    };
    contactsLocationsModule?: {
      locations?: Array<{ country?: string }>;
    };
  };
}

const NCT_LOOKUP_FIELDS = [
  "NCTId",
  "BriefTitle",
  "OfficialTitle",
  "Condition",
  "OverallStatus",
  "Phase",
  "EnrollmentCount",
  "EnrollmentType",
  "Sex",
  "MinimumAge",
  "MaximumAge",
  "HealthyVolunteers",
  "StartDate",
  "PrimaryCompletionDate",
  "LocationCountry",
].join(",");

/**
 * GET /studies/{nctId}?fields=... — a single study by its NCT number, for the
 * landing page's "Search by NCT Number" auto-fill. Returns null when the ID
 * isn't found (ClinicalTrials.gov 404s unknown/malformed NCT numbers) or on
 * any fetch failure — callers show a "not found, try manual entry" message
 * rather than a raw error either way, so the two cases are collapsed here.
 */
export async function getStudyByNctId(
  nctId: string,
): Promise<NctStudyLookup | null> {
  const id = nctId.trim().toUpperCase();
  if (!id) return null;
  if (!config.ctgov.enabled) return null;

  const cacheKey = `nct-lookup:${id}`;
  const cached = getCached<NctStudyLookup | null>(cacheKey);
  if (cached !== undefined) return cached;

  const url = `${BASE_URL}/studies/${encodeURIComponent(id)}?fields=${NCT_LOOKUP_FIELDS}`;

  try {
    const json = await fetchJson<RawNctStudy>(url, config.ctgov.timeoutMs);
    const ps = json.protocolSection;
    if (!ps?.identificationModule?.nctId) {
      setCached(cacheKey, null, config.ctgov.cacheTtlMs);
      return null;
    }
    const locations = ps.contactsLocationsModule?.locations ?? [];
    const countries = [
      ...new Set(
        locations
          .map((l) => l.country)
          .filter((c): c is string => !!c && c.trim().length > 0),
      ),
    ];
    const conditions = ps.conditionsModule?.conditions ?? [];
    const result: NctStudyLookup = {
      nctId: ps.identificationModule.nctId,
      briefTitle: ps.identificationModule.briefTitle ?? null,
      officialTitle: ps.identificationModule.officialTitle ?? null,
      condition: conditions[0] ?? null,
      conditions,
      overallStatus: ps.statusModule?.overallStatus ?? null,
      phases: ps.designModule?.phases ?? [],
      enrollmentCount:
        typeof ps.designModule?.enrollmentInfo?.count === "number"
          ? ps.designModule.enrollmentInfo.count
          : null,
      enrollmentType: ps.designModule?.enrollmentInfo?.type ?? null,
      sex: ps.eligibilityModule?.sex ?? null,
      minimumAge: ps.eligibilityModule?.minimumAge ?? null,
      maximumAge: ps.eligibilityModule?.maximumAge ?? null,
      healthyVolunteers:
        typeof ps.eligibilityModule?.healthyVolunteers === "boolean"
          ? ps.eligibilityModule.healthyVolunteers
          : null,
      startDate: ps.statusModule?.startDateStruct?.date ?? null,
      primaryCompletionDate:
        ps.statusModule?.primaryCompletionDateStruct?.date ?? null,
      countries,
      siteCount: locations.length,
    };
    setCached(cacheKey, result, config.ctgov.cacheTtlMs);
    return result;
  } catch (err) {
    warn(`NCT lookup failed for "${id}"`, err);
    return null;
  }
}

/* ---------------------------------------------------------------------- */
/* 1. Active competing trials count                                       */
/* ---------------------------------------------------------------------- */

/**
 * Live replacement for RegionRow["Active Competing Trials"].
 * GET /studies?query.cond={condition}&query.locn={country}
 *     &filter.overallStatus={config.competingTrials.statuses.join(",")}&countTotal=true&pageSize=1
 *
 * Which statuses count as "ongoing/competing" is a business definition, not
 * a ClinicalTrials.gov constant — see config.ts's competingTrials.statuses
 * doc comment. Defaults to RECRUITING, NOT_YET_RECRUITING,
 * ACTIVE_NOT_RECRUITING, and ENROLLING_BY_INVITATION (i.e. anything still
 * actively running), excluding terminal statuses like COMPLETED/TERMINATED/
 * WITHDRAWN/SUSPENDED — adjustable via the COMPETING_TRIAL_STATUSES env var
 * without touching this query-building code.
 */
export async function getActiveCompetingTrialsCount(
  condition: string,
  /** Empty string = global count across every country (matches getFacilitiesForCondition's own global default when no country is given) — do NOT substitute a default country here, or a caller showing both this count and a global facilities list side by side (see controllers/liveTrials.controller.ts) will show two numbers that don't reconcile. */
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

/* ---------------------------------------------------------------------- */
/* 1c. Eligibility criteria sample (real, disclosed trial text)           */
/* ---------------------------------------------------------------------- */

export interface EligibilityCriteriaSample {
  sourceNctId: string;
  sourceBriefTitle: string | null;
  /** Raw disclosed eligibilityModule.eligibilityCriteria text — typically an "Inclusion Criteria:" / "Exclusion Criteria:" free-text block, not structured data. Shown to the user as-is; NOT used to filter the synthetic patient-population count, since that dataset has no comorbidity/condition attributes to filter against (see data/syntheticPopulation.ts). */
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
      // No currently-recruiting trial found for this indication — fall back
      // to any status rather than returning nothing, since the criteria
      // text itself doesn't go stale the way a recruiting-status count would.
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
  /** The location's own disclosed recruitment status, or the study's overall status when the location-level one isn't disclosed (common for older/completed trials) — see getFacilitiesForCondition's doc comment. */
  status: string | null;
  /** protocolSection.statusModule.lastUpdatePostDateStruct.date — when the sponsor last updated this trial's record on ClinicalTrials.gov. */
  lastUpdatePostDate: string | null;
  /**
   * Real, disclosed protocolSection.eligibilityModule.minimumAge/maximumAge
   * for the STUDY this facility location belongs to. NOT a per-location
   * field ClinicalTrials.gov itself tracks — age eligibility is set once for
   * the whole protocol, so every location within the SAME study shares this
   * same value. It still varies genuinely across the facility list as a
   * whole, though, because different facilities here usually come from
   * different studies with different eligibility windows — used to build a
   * real per-site "Patient age" requirement check (see
   * pipeline/runPipeline.ts's checkRequirements).
   */
  minimumAge: string | null;
  maximumAge: string | null;
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

/**
 * Live cross-check for SiteRow — real facilities ClinicalTrials.gov has
 * on record as running (or having run) trials for this condition.
 * GET /studies?query.cond={condition}[&query.locn={country}]
 *     &fields=NCTId,BriefTitle,OverallStatus,LastUpdatePostDate,LocationFacility,LocationCity,LocationState,LocationCountry,LocationStatus
 *
 * Per-location recruitment status (LocationStatus) is only disclosed by
 * ClinicalTrials.gov for a subset of trials (mainly ones that actively
 * report site-level recruitment) — many trials, especially older/completed
 * ones, leave it blank even though the study itself always has an overall
 * status. Rather than show every such row as "Unknown," this falls back to
 * the study's own OverallStatus when the location-specific one is missing,
 * so a row still shows a real, disclosed status rather than nothing.
 */
/**
 * Turns the trial form's selected Age Group label(s) into the standardized
 * CHILD / ADULT / OLDER_ADULT values ClinicalTrials.gov itself classifies
 * studies into (the same buckets its own site's age filter uses).
 */
export function selectedStdAgeValues(ageGroups: string[] | undefined): Set<string> {
  const values = new Set<string>();
  for (const g of ageGroups ?? []) {
    if (/older\s*adult/i.test(g)) values.add("OLDER_ADULT");
    else if (/^child/i.test(g)) values.add("CHILD");
    else if (/^adult/i.test(g)) values.add("ADULT");
  }
  return values;
}

// Same 18/65-year cutoffs ClinicalTrials.gov uses for its own CHILD / ADULT /
// OLDER_ADULT (StdAge) classification.
const CHILD_UPPER_YEARS = 18;
const OLDER_ADULT_LOWER_YEARS = 65;

/**
 * Parses a ClinicalTrials.gov eligibility age string ("18 Years", "6 Months",
 * "45 Days", "N/A") into a age in years. Returns null for "N/A"/missing/
 * unparseable — callers treat null as "no bound" (0 for a minimum, +Infinity
 * for a maximum), matching how ClinicalTrials.gov treats an absent
 * MinimumAge/MaximumAge as no lower/upper limit.
 */
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
      return n / 365; // day
  }
}

/**
 * Derives which StdAge bucket(s) a study's real, disclosed MinimumAge/
 * MaximumAge eligibility range overlaps — computed locally from the same
 * two fields ClinicalTrials.gov's own StdAge classification is itself
 * derived from, rather than trusting an Essie `query.term=AREA[StdAge]...`
 * filter sent to the live API (whose exact syntax/behavior this sandbox has
 * no live network access to verify — see the old version of this comment,
 * kept for history in git). Computing the bucket ourselves from two already-
 * fetched, already-used-elsewhere-in-this-file fields is fully testable and
 * doesn't depend on unverifiable server-side query behavior. A study with no
 * age fields disclosed is treated as "all ages" (matches every group) rather
 * than excluded, since an unknown eligibility range is not evidence the
 * study excludes anyone.
 */
export function studyAgeGroups(
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
    /**
     * Restrict the live query itself to these OverallStatus values (e.g.
     * config.competingTrials.statuses) via ClinicalTrials.gov's own
     * filter.overallStatus param, rather than fetching an unfiltered page and
     * filtering client-side afterward. Matters for a caller that only wants
     * live/active trials as candidates (buildLiveCandidateSites): without
     * this, a fixed-size page of raw, unfiltered rows can fill up with
     * Completed/Terminated studies before ever reaching a Recruiting one,
     * even though ClinicalTrials.gov has plenty of matching Recruiting
     * facilities for the same condition/country. Omit for a caller that
     * intentionally wants every status (e.g. the Ongoing Trials panel, which
     * offers its own status filter over the full, unfiltered result set).
     */
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
      // Real age-eligibility filter, computed locally from this study's own
      // disclosed MinimumAge/MaximumAge (see studyAgeGroups) rather than sent
      // to the live API as an unverified query — see that function's doc
      // comment. Applied at the STUDY level (MinimumAge/MaximumAge aren't
      // per-location fields), so either every location below is kept or the
      // whole study is skipped.
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
          minimumAge: study.protocolSection?.eligibilityModule?.minimumAge ?? null,
          maximumAge: study.protocolSection?.eligibilityModule?.maximumAge ?? null,
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

// NOTE ON FIELD NAMES BELOW: EnrollmentCount/EnrollmentType, DesignAllocation/
// DesignInterventionModel/DesignMasking, InterventionType, LastUpdatePostDate
// and StatusVerifiedDate are documented v2 API fields, but this sandbox has no
// live network access to clinicaltrials.gov to confirm the exact response
// shape at runtime (only the already-used fields above them were verified
// this way, earlier in this project). The parsing below is defensive — any
// field that's missing, renamed, or shaped differently just comes back
// `null`/empty (same "absence, not a crash" pattern as everywhere else in
// this file) — but spot-check one real response against these paths once
// this is deployed, before trusting the new categories that depend on them.
export interface FacilityTrialRecord {
  nctId: string;
  briefTitle: string | null;
  /** RECRUITING, COMPLETED, TERMINATED, WITHDRAWN, SUSPENDED, etc. */
  overallStatus: string | null;
  /** Sponsor-disclosed reason, present mainly on TERMINATED/WITHDRAWN/SUSPENDED trials. */
  whyStopped: string | null;
  /** Whether ClinicalTrials.gov has a results section posted for this study — a disclosed fact, not an estimate. */
  hasResults: boolean | null;
  /** protocolSection.statusModule.primaryCompletionDateStruct.date, as reported — used only to flag overdue/missing results reporting. */
  primaryCompletionDate: string | null;
  /** designModule.enrollmentInfo.count — total across all sites in the study, not facility-specific. */
  enrollmentCount: number | null;
  /** designModule.enrollmentInfo.type — "ACTUAL" (post-completion, reliable) or "ESTIMATED" (a target, not a result). */
  enrollmentType: string | null;
  /** designModule.designInfo.allocation — e.g. RANDOMIZED, NON_RANDOMIZED, NA. */
  designAllocation: string | null;
  /** designModule.designInfo.interventionModel — e.g. PARALLEL, CROSSOVER, FACTORIAL, SINGLE_GROUP, SEQUENTIAL. */
  designInterventionModel: string | null;
  /** designModule.designInfo.maskingInfo.masking — NONE, SINGLE, DOUBLE, TRIPLE, QUADRUPLE. */
  designMasking: string | null;
  /** armsInterventionsModule.interventions[].type — Drug, Device, Biological, Behavioral, etc. (can be more than one per study). */
  interventionTypes: string[];
  /** statusModule.lastUpdatePostDateStruct.date — when the sponsor last updated this record on the registry. */
  lastUpdatePostDate: string | null;
  /** statusModule.statusVerifiedDate — when the sponsor last attested the record is still accurate; distinct from LastUpdatePostDate. */
  statusVerifiedDate: string | null;
  /** statusModule.startDateStruct.date — when the trial began; paired with primaryCompletionDate to derive a real (trial-total, not per-site) enrollment-rate proxy. */
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

/**
 * Real, factual risk signal — deliberately does NOT filter by overallStatus,
 * so it captures TERMINATED/WITHDRAWN/SUSPENDED trials at a facility, not
 * just currently-recruiting ones. This is a live, non-estimated source of
 * per-site risk signal: a facility whose trials were terminated (with a
 * disclosed reason) is a real, disclosed fact, not a guess. It also carries
 * HasResults/PrimaryCompletionDate so callers can flag overdue/missing
 * results reporting, plus enrollment/design/reporting-diligence fields for
 * the Enrollment-shortfall, Protocol Complexity and Reporting Diligence
 * signals — all real, disclosed facts, not guesses.
 * GET /studies?query.cond={condition}[&query.locn={country}]&fields=...
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

/**
 * Broader, facility-only version of getFacilityHistories: queries by facility
 * NAME (via query.locn, which free-text-matches location fields including
 * facility name — the same parameter already used for country matching
 * elsewhere in this file) with NO condition filter, so it returns this one
 * facility's trial history across ALL indications, not just the one being
 * evaluated. This exists to fix a real statistical problem: the
 * indication-scoped history above is often just 1-2 trials per facility,
 * making termination/overdue rates noisy. A facility's overall track record
 * across every trial it has run is a bigger, steadier sample.
 *
 * PRECISION CAVEAT (real, not hypothetical): query.locn does a broad
 * free-text match across location fields, not an exact facility-name match.
 * A generic or very common facility name could over-match unrelated studies
 * at a same-named-but-different facility elsewhere. City is used as a
 * secondary filter to reduce false positives, but this is a best-effort
 * widening, not a guaranteed-precise one — treat the resulting rate as
 * "this facility's likely broader track record," not an exact figure.
 * Returns null (not an empty history) on any fetch failure or zero results,
 * so callers can fall back to the indication-scoped history rather than
 * silently substituting a misleadingly empty one.
 */
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

/* ---------------------------------------------------------------------- */
/* 2c. Real posted-results signal (dropout / diversity) for one trial      */
/* ---------------------------------------------------------------------- */

/**
 * Real, disclosed dropout and diversity figures pulled from a single trial's
 * POSTED RESULTS (resultsSection) — not an estimate. Two structural limits,
 * both real and worth repeating anywhere this is surfaced:
 *
 *  1. Only trials with `HasResults = true` have a resultsSection at all —
 *     historically a minority of registered trials (most completed
 *     interventional trials post results eventually, but many never do, and
 *     ongoing/recently-completed trials usually haven't yet).
 *  2. Everything in resultsSection is reported per treatment ARM for the
 *     WHOLE TRIAL — ClinicalTrials.gov has no per-site breakout anywhere in
 *     its public schema. So this is "the dropout rate / participant
 *     diversity of this trial, aggregated across every site that ran it,"
 *     not "this specific facility's own patients." Callers should present it
 *     as a real-but-trial-level signal, not a site-level one.
 *
 * Field/module names below (resultsSection.participantFlowModule,
 * resultsSection.baselineCharacteristicsModule) are documented v2 API shape
 * but NOT live-verified in this sandbox (no network access to
 * clinicaltrials.gov) — spot-check one real response once deployed. Parsing
 * is defensive: any missing/renamed/reshaped field just yields `null` rather
 * than throwing.
 */
export interface RaceBreakdownEntry {
  /** Real category name as reported by ClinicalTrials.gov (e.g. "White", "Black or African American", "Hispanic or Latino", "Asian", "American Indian or Alaska Native"). */
  category: string;
  /** 0-100, this category's share of the trial's total reported race/ethnicity count. Rounded to 1 decimal. */
  percent: number;
}

export interface FacilityResultsSignal {
  /** 0-100. null if no STARTED/COMPLETED milestone data could be parsed. */
  dropoutRatePercent: number | null;
  /** 0-100 (Gini-Simpson diversity index over Race/Ethnicity categories, scaled). null if no race/ethnicity breakdown was found. */
  diversityIndex: number | null;
  /**
   * The actual real category-by-category breakdown the diversityIndex above
   * was computed from (e.g. [{category:"White",percent:61.2}, ...]) — kept
   * around instead of discarded, so the UI can show the real ratio itself
   * rather than only the collapsed 0-100 index. Same trial-wide caveat as
   * diversityIndex: this is pooled across the whole study (every site that
   * participated), not specific to any one facility. null whenever
   * diversityIndex is null.
   */
  raceBreakdown: RaceBreakdownEntry[] | null;
  /**
   * 0-100 — real, disclosed serious-adverse-event rate: sum(seriousNumAffected)
   * / sum(seriousNumAtRisk) across resultsSection.adverseEventsModule.eventGroups
   * for this trial, i.e. the same trial-wide (not facility-specific) figure
   * this whole signal is already scoped to. null if the trial has no posted
   * adverseEventsModule or its at-risk denominator is 0. NOT spot-checked
   * against a live response in this sandbox (no network access here) — the
   * field path is per documented ClinicalTrials.gov v2 schema; verify once
   * deployed, same caveat as the other newer fields in this file.
   */
  seriousAdverseEventRatePercent: number | null;
  /** The NCTId this signal was pulled from, so callers/UI can cite the source trial. */
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

/**
 * Computes the Gini-Simpson diversity index AND returns the real
 * category-by-category breakdown it was computed from (category name +
 * real reported count per category) — previously this function discarded
 * the breakdown and returned only the collapsed index, so the UI had no way
 * to show the actual real race/ethnicity ratio, only a single opaque
 * number.
 */
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
  // Gini-Simpson diversity index: 1 - sum(p_i^2), scaled to 0-100.
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
    // Largest share first — reads better in a tooltip/list than source order.
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

/**
 * Real, disclosed serious-adverse-event rate: sum(seriousNumAffected) /
 * sum(seriousNumAtRisk) across every arm/group in the trial's posted
 * adverseEventsModule.eventGroups — a trial-wide figure (this API has no
 * facility-level breakdown of adverse events), same scope caveat as dropout
 * rate/diversity index above. null if no eventGroups were posted or the
 * at-risk denominator sums to 0.
 */
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
