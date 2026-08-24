export interface SyntheticSiteCost {
  /** One-time per-site setup/regulatory/IRB/monitoring cost, independent of how many patients it enrolls. */
  baseCostUsd: number;
  /** Incremental cost per patient enrolled at this site (procedures, visits, site payments). */
  perPatientCostUsd: number;
  costSource: "synthetic";
}

const BASE_COST_RANGE_USD: [number, number] = [15_000, 65_000];
const PER_PATIENT_COST_RANGE_USD: [number, number] = [3_000, 14_000];

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
