import { config } from "../config.js";

/**
 * Orphanet / Orphadata integration for the Rare Disease feature.
 *
 * Corrected from an earlier version of this file: api.orphadata.com's public
 * "Rare diseases aligned with terminologies and databases" / "Epidemiology
 * of rare diseases" / "Natural history of rare diseases" endpoints are
 * genuinely open — CC BY 4.0, NO API key or registration required (verified
 * directly against the live API, e.g. GET
 * https://api.orphadata.com/rd-epidemiology/orphacodes/558). The earlier
 * version of this client mistakenly routed through api.orphacode.org, which
 * DOES require a registered key — that was wrong for this use case and has
 * been replaced.
 *
 * Two data paths:
 *
 * 1. Search-by-name: GET /rd-cross-referencing/orphacodes/names/{name} only
 *    does an EXACT preferred-term match (confirmed — "marf" returns nothing,
 *    "Marfan syndrome" returns exactly one result), so it can't power a
 *    type-ahead dropdown on its own. Instead this fetches the full disease
 *    list once — GET /rd-cross-referencing/orphacodes (~11,600 diseases,
 *    ORPHAcode + preferred term only) — caches it in memory, and does local
 *    substring matching against it. Still entirely real Orphanet data, just
 *    refreshed periodically rather than re-fetched per keystroke.
 *
 * 2. Detail, live per ORPHAcode, no key required:
 *    - GET /rd-cross-referencing/orphacodes/{orphacode}  (name, definition,
 *      typology, synonyms, ICD-10/ICD-11/OMIM/MONDO/MeSH/UMLS/GARD mappings)
 *    - GET /rd-epidemiology/orphacodes/{orphacode}        (prevalence/incidence)
 *    - GET /rd-natural_history/orphacodes/{orphacode}     (inheritance,
 *      average age of onset, average age of death when Orphanet has it)
 */

const BASE_URL = "https://api.orphadata.com";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

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

function warn(label: string, err: unknown): void {
  console.warn(`[orphadata] ${label}:`, (err as Error)?.message ?? err);
}

async function orphadataGet<T>(path: string): Promise<T | null> {
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.rareDisease.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Orphadata API responded ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------- */
/* 1. Search — bulk list fetched once, cached, searched locally            */
/* ---------------------------------------------------------------------- */

export interface RareDiseaseSearchResult {
  orphaCode: string;
  name: string;
}

interface OrphacodeListResponse {
  data?: {
    results?: { ORPHAcode?: number; "Preferred term"?: string }[];
  };
}

async function getDiseaseIndex(): Promise<RareDiseaseSearchResult[]> {
  const cacheKey = "disease-index";
  const cached = getCached<RareDiseaseSearchResult[]>(cacheKey);
  if (cached !== undefined) return cached;

  const json = await orphadataGet<OrphacodeListResponse>("/rd-cross-referencing/orphacodes");
  const list: RareDiseaseSearchResult[] = (json?.data?.results ?? [])
    .filter((e) => e.ORPHAcode != null && e["Preferred term"])
    .map((e) => ({ orphaCode: String(e.ORPHAcode), name: e["Preferred term"]! }));
  setCached(cacheKey, list, config.rareDisease.bulkFileCacheTtlMs);
  return list;
}

/** Local, real-data substring search over Orphanet's full disease list — see getDiseaseIndex. */
export async function searchRareDiseasesByName(
  query: string,
): Promise<RareDiseaseSearchResult[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  try {
    const index = await getDiseaseIndex();
    return index
      .filter((d) => d.name.toLowerCase().includes(trimmed))
      // Shorter/closer matches first, then alphabetical — same relevance
      // proxy already used by indicationSearch's live ClinicalTrials.gov search.
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
      .slice(0, 40);
  } catch (err) {
    warn(`disease-name search failed for "${trimmed}"`, err);
    return [];
  }
}

/* ---------------------------------------------------------------------- */
/* 2. Detail — live per-ORPHAcode, no key required                        */
/* ---------------------------------------------------------------------- */

export interface RareDiseaseNomenclature {
  orphaCode: string;
  name: string;
  definition: string | null;
  typology: string | null;
  synonyms: string[];
  /** e.g. [{source:"ICD-10", reference:"Q87.4"}, {source:"OMIM", reference:"154700"}, ...] */
  crossReferences: { source: string; reference: string }[];
}

interface DisorderCrossRefResponse {
  data?: {
    results?: {
      ORPHAcode?: number;
      "Preferred term"?: string;
      Typology?: string;
      SummaryInformation?: { Definition?: string }[];
      Synonym?: string[];
      ExternalReference?: { Source?: string; Reference?: string }[];
    };
  };
}

export async function getRareDiseaseNomenclature(
  orphaCode: string,
): Promise<RareDiseaseNomenclature | null> {
  const cacheKey = `nomenclature:${orphaCode}`;
  const cached = getCached<RareDiseaseNomenclature | null>(cacheKey);
  if (cached !== undefined) return cached;

  const json = await orphadataGet<DisorderCrossRefResponse>(
    `/rd-cross-referencing/orphacodes/${encodeURIComponent(orphaCode)}`,
  );
  const r = json?.data?.results;
  if (!r || r.ORPHAcode == null) {
    setCached(cacheKey, null, config.rareDisease.searchCacheTtlMs);
    return null;
  }
  const result: RareDiseaseNomenclature = {
    orphaCode: String(r.ORPHAcode),
    name: r["Preferred term"] ?? "",
    definition: r.SummaryInformation?.[0]?.Definition ?? null,
    typology: r.Typology ?? null,
    synonyms: r.Synonym ?? [],
    crossReferences: (r.ExternalReference ?? [])
      .filter((e) => e.Source && e.Reference)
      .map((e) => ({ source: e.Source!, reference: e.Reference! })),
  };
  setCached(cacheKey, result, config.rareDisease.searchCacheTtlMs);
  return result;
}

export interface RareDiseasePrevalenceRecord {
  type: string | null;
  qualification: string | null;
  prevalenceClass: string | null;
  value: string | null;
  geographicArea: string | null;
  validationStatus: string | null;
  source: string | null;
}

interface EpidemiologyResponse {
  data?: {
    results?: {
      Prevalence?: {
        PrevalenceType?: string;
        PrevalenceQualification?: string;
        PrevalenceClass?: string;
        ValMoy?: string;
        PrevalenceGeographic?: string;
        PrevalenceValidationStatus?: string;
        Source?: string;
      }[];
    };
  };
}

export async function getRareDiseaseEpidemiology(
  orphaCode: string,
): Promise<RareDiseasePrevalenceRecord[]> {
  const cacheKey = `epidemiology:${orphaCode}`;
  const cached = getCached<RareDiseasePrevalenceRecord[]>(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const json = await orphadataGet<EpidemiologyResponse>(
      `/rd-epidemiology/orphacodes/${encodeURIComponent(orphaCode)}`,
    );
    const records: RareDiseasePrevalenceRecord[] = (json?.data?.results?.Prevalence ?? []).map(
      (p) => ({
        type: p.PrevalenceType ?? null,
        qualification: p.PrevalenceQualification ?? null,
        prevalenceClass: p.PrevalenceClass ?? null,
        value: p.ValMoy ?? null,
        geographicArea: p.PrevalenceGeographic ?? null,
        validationStatus: p.PrevalenceValidationStatus ?? null,
        source: p.Source ?? null,
      }),
    );
    setCached(cacheKey, records, config.rareDisease.searchCacheTtlMs);
    return records;
  } catch (err) {
    warn(`epidemiology lookup failed for orphacode ${orphaCode}`, err);
    return [];
  }
}

export interface RareDiseaseNaturalHistory {
  averageAgeOfOnset: string[];
  averageAgeOfDeath: string[];
  typeOfInheritance: string[];
}

interface NaturalHistoryResponse {
  data?: {
    results?: {
      AverageAgeOfOnset?: string[];
      AverageAgeOfDeath?: string[];
      TypeOfInheritance?: string[];
    };
  };
}

export async function getRareDiseaseNaturalHistory(
  orphaCode: string,
): Promise<RareDiseaseNaturalHistory> {
  const cacheKey = `natural-history:${orphaCode}`;
  const cached = getCached<RareDiseaseNaturalHistory>(cacheKey);
  if (cached !== undefined) return cached;

  const empty: RareDiseaseNaturalHistory = {
    averageAgeOfOnset: [],
    averageAgeOfDeath: [],
    typeOfInheritance: [],
  };
  try {
    const json = await orphadataGet<NaturalHistoryResponse>(
      `/rd-natural_history/orphacodes/${encodeURIComponent(orphaCode)}`,
    );
    const r = json?.data?.results;
    const result: RareDiseaseNaturalHistory = r
      ? {
          averageAgeOfOnset: r.AverageAgeOfOnset ?? [],
          averageAgeOfDeath: r.AverageAgeOfDeath ?? [],
          typeOfInheritance: r.TypeOfInheritance ?? [],
        }
      : empty;
    setCached(cacheKey, result, config.rareDisease.searchCacheTtlMs);
    return result;
  } catch (err) {
    warn(`natural-history lookup failed for orphacode ${orphaCode}`, err);
    return empty;
  }
}

/* ---------------------------------------------------------------------- */
/* 3. Region-metrics integration — real Orphanet prevalence, when it       */
/*    exists, in place of liveRegionMetrics.ts's claims-synthetic/LLM      */
/*    fallback. See buildLiveRegionRow in pipeline/liveRegionMetrics.ts.   */
/* ---------------------------------------------------------------------- */

interface ExactNameResponse {
  data?: {
    results?: { ORPHAcode?: number } | { ORPHAcode?: number }[];
  };
}

/**
 * GET /rd-cross-referencing/orphacodes/names/{name} — EXACT preferred-term
 * match only (confirmed: "marf" returns nothing, "Marfan syndrome" returns
 * exactly one hit). That's exactly what's needed here: the trial form's
 * Indication string either is a real Orphanet preferred term or it isn't —
 * there's no fuzzy-matching ambiguity to resolve.
 */
async function findOrphaCodeByExactName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const cacheKey = `exact-name:${trimmed.toLowerCase()}`;
  const cached = getCached<string | null>(cacheKey);
  if (cached !== undefined) return cached;

  let orphaCode: string | null = null;
  try {
    const json = await orphadataGet<ExactNameResponse>(
      `/rd-cross-referencing/orphacodes/names/${encodeURIComponent(trimmed)}`,
    );
    const results = json?.data?.results;
    const entry = Array.isArray(results) ? results[0] : results;
    orphaCode = entry?.ORPHAcode != null ? String(entry.ORPHAcode) : null;
  } catch (err) {
    warn(`exact-name lookup failed for "${trimmed}"`, err);
  }
  setCached(cacheKey, orphaCode, config.rareDisease.searchCacheTtlMs);
  return orphaCode;
}

// Only these three types describe a standing prevalence (a snapshot of how
// many people currently have the disease) — "Annual incidence" is a rate of
// NEW cases per year, not a population snapshot, and "Cases/families" is an
// absolute headcount with no denominator, so neither converts to a per-100k
// rate. Ordered by how directly each represents current disease burden.
const PREVALENCE_TYPE_PRIORITY = ["Point prevalence", "Prevalence at birth", "Lifelong prevalence"];

/**
 * Orphanet's PrevalenceClass is a documented, stable six-tier scale (e.g.
 * "1-5 / 10 000", "1-9 / 100 000", "<1 / 1 000 000") — unlike the numeric
 * ValMoy field, whose exact unit isn't confirmed from any public Orphanet
 * documentation this integration could access, so ValMoy is deliberately
 * NOT used here to avoid silently asserting a possibly-wrong number. This
 * parses the class string itself and returns the class's own midpoint
 * (or, for an open-ended "<"/">" class, a rough single-sided estimate) as a
 * per-100,000 rate. This is a real approximation of Orphanet's own
 * published category, not a precise point estimate — callers should treat
 * it accordingly (e.g. still label it as an estimate in any UI).
 */
function parsePrevalenceClassPer100k(prevalenceClass: string): number | null {
  const s = prevalenceClass.replace(/[,\s]/g, "");
  const m = /^([<>]?)(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?\/(\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return null;
  const [, prefix, lowStr, highStr, denomStr] = m;
  const denom = Number(denomStr);
  const low = Number(lowStr);
  if (!Number.isFinite(denom) || denom <= 0 || !Number.isFinite(low)) return null;
  let mid: number;
  if (highStr) {
    const high = Number(highStr);
    mid = Number.isFinite(high) ? (low + high) / 2 : low;
  } else if (prefix === "<") {
    mid = low / 2;
  } else if (prefix === ">") {
    mid = low * 1.5;
  } else {
    mid = low;
  }
  return (mid / denom) * 100_000;
}

export interface OrphanetPrevalenceMatch {
  perHundredK: number;
  orphaCode: string;
  citation: string;
}

/**
 * Real, live Orphanet prevalence for one indication + country, for use as a
 * higher-priority replacement of liveRegionMetrics.ts's claims-synthetic/
 * LLM-estimated "Prevalence (per 100k)" — but ONLY when the trial form's
 * Indication string is an exact Orphanet preferred term (a real rare
 * disease) AND Orphanet has a prevalence record geographically specific to
 * this exact country, or at worst "Worldwide". A record scoped to some
 * OTHER named region (e.g. "Europe" when the target country is "Ukraine")
 * is deliberately NOT used — applying a continent-wide figure to one named
 * country without a documented sub-breakdown would be a guess dressed up as
 * real data, which defeats the point of replacing an LLM guess with one.
 * Returns null whenever no confidently-scoped real match exists, so the
 * caller can fall back to claims/LLM exactly as before.
 */
export async function getOrphanetPrevalencePer100k(
  indication: string,
  country: string,
): Promise<OrphanetPrevalenceMatch | null> {
  const orphaCode = await findOrphaCodeByExactName(indication);
  if (!orphaCode) return null;

  const records = await getRareDiseaseEpidemiology(orphaCode);
  const countryLower = country.trim().toLowerCase();

  const scored = records
    .filter(
      (r) =>
        r.type &&
        PREVALENCE_TYPE_PRIORITY.includes(r.type) &&
        r.prevalenceClass &&
        r.geographicArea,
    )
    .map((r) => {
      const geoLower = r.geographicArea!.trim().toLowerCase();
      const geoScore = geoLower === countryLower ? 2 : geoLower === "worldwide" ? 1 : 0;
      return { record: r, geoScore, typeRank: PREVALENCE_TYPE_PRIORITY.indexOf(r.type!) };
    })
    .filter((s) => s.geoScore > 0)
    .sort((a, b) => {
      if (a.geoScore !== b.geoScore) return b.geoScore - a.geoScore;
      if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
      const aValidated = a.record.validationStatus === "Validated" ? 0 : 1;
      const bValidated = b.record.validationStatus === "Validated" ? 0 : 1;
      return aValidated - bValidated;
    });

  const best = scored[0];
  if (!best) return null;

  const perHundredK = parsePrevalenceClassPer100k(best.record.prevalenceClass!);
  if (perHundredK === null) return null;

  return {
    perHundredK: Math.round(perHundredK * 100) / 100,
    orphaCode,
    citation:
      `Orphanet ORPHA:${orphaCode} — ${best.record.type}, ${best.record.geographicArea}, ` +
      `${best.record.validationStatus ?? "validation status unknown"} — class ${best.record.prevalenceClass}` +
      (best.record.source ? ` (${best.record.source})` : ""),
  };
}
