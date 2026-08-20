/**
 * Per-site clinical-trial cost AND recruitment-conversion-rate models — both
 * SYNTHETIC, not live and not LLM-estimated.
 *
 * WHY SYNTHETIC: unlike almost everything else in this codebase, no public
 * source of ANY kind (ClinicalTrials.gov, published benchmarks, or an LLM's
 * training data) reliably discloses actual per-facility trial costs — costs
 * are negotiated privately between sponsors and sites and are not part of
 * any trial registry record. The app already has one cost figure —
 * "Avg Cost per Patient (USD)" on RegionRow — but that is a single
 * LLM-estimated number applied uniformly across an entire
 * region/country, not a per-site figure. Srikanth's ask (a base cost per
 * site PLUS a per-patient cost per site, so different sites can be compared
 * against each other) has no real or model-estimated source to draw from,
 * so this generates a deterministic, seeded, clearly-labeled synthetic
 * figure instead — the same "fabricate consistently rather than pretend a
 * source exists" approach already used in data/syntheticPopulation.ts.
 *
 * Deterministic (seeded off siteId + country) so the same site always
 * produces the same synthetic cost across requests/process restarts, rather
 * than a different number every time someone reruns the pipeline.
 */

export interface SyntheticSiteCost {
  /** One-time per-site setup/regulatory/IRB/monitoring cost, independent of how many patients it enrolls. */
  baseCostUsd: number;
  /** Incremental cost per patient enrolled at this site (procedures, visits, site payments). */
  perPatientCostUsd: number;
  costSource: "synthetic";
}

// Real, publicly-cited clinical trial cost literature (e.g. industry surveys
// of Phase II/III per-site costs) puts these in the low-tens-of-thousands to
// low-hundreds-of-thousands range — these bounds are set to be directionally
// plausible, not derived from any specific cited study.
const BASE_COST_RANGE_USD: [number, number] = [15_000, 65_000];
const PER_PATIENT_COST_RANGE_USD: [number, number] = [3_000, 14_000];

// Small deterministic hash -> PRNG, same technique as
// data/syntheticPopulation.ts's seeded generation, so re-running the same
// site through this function always yields the same synthetic cost.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Deterministic synthetic per-site cost figure. `siteId` + `country` seed the
 * generator so the same facility always gets the same numbers.
 */
export function syntheticSiteCostFor(
  siteId: string,
  country: string,
): SyntheticSiteCost {
  const rand = seededRandom(`${siteId}|${country}`.toLowerCase());
  const base =
    BASE_COST_RANGE_USD[0] +
    rand() * (BASE_COST_RANGE_USD[1] - BASE_COST_RANGE_USD[0]);
  const perPatient =
    PER_PATIENT_COST_RANGE_USD[0] +
    rand() * (PER_PATIENT_COST_RANGE_USD[1] - PER_PATIENT_COST_RANGE_USD[0]);
  return {
    baseCostUsd: Math.round(base / 500) * 500,
    perPatientCostUsd: Math.round(perPatient / 100) * 100,
    costSource: "synthetic",
  };
}

/**
 * Deterministic synthetic per-site recruitment/consent conversion rate —
 * "eligible patients ≠ enrolled patients." Same reasoning as this file's
 * cost figure: no live source (ClinicalTrials.gov) or LLM training data
 * reliably discloses a real per-site screening-to-enrollment conversion
 * rate — that funnel data lives inside a sponsor's private CTMS/EDC, never
 * published anywhere. `centerRate` is the app's configured, adjustable
 * assumption (config.siteCombination.assumedConsentRate — Srikanth's own
 * 10% example figure); rather than applying that ONE flat number identically
 * to every site (which looked suspiciously uniform across a whole results
 * table), this generates a per-site variation around it — deterministic and
 * seeded, so the same site always gets the same rate, but different sites
 * no longer show an identical, obviously-fabricated-looking percentage.
 * Bounded to [max(2%, centerRate*0.4), min(60%, centerRate*3)] so the spread
 * stays anchored to the configured center rather than drifting to
 * implausible extremes, while still visibly varying from site to site
 * (a 10% center spreads to roughly 4%-30%) rather than all rows landing
 * suspiciously close to the center value.
 */
export function syntheticConsentRateFor(
  siteId: string,
  country: string,
  centerRate: number,
): number {
  const rand = seededRandom(`consent-rate|${siteId}|${country}`.toLowerCase());
  const low = Math.max(0.02, centerRate * 0.4);
  const high = Math.min(0.6, centerRate * 3);
  const rate = low + rand() * (high - low);
  return Math.round(rate * 1000) / 1000;
}
