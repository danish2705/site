/**
 * Synthetic PATIENT-LEVEL records — Srikanth's requirement #4 ("Update
 * Synthetic Patient Data"). Until now, the app's only synthetic dataset
 * (data/syntheticPopulation.ts) represented aggregate population counts per
 * postal region — there was no notion of an individual patient anywhere in
 * the app, let alone one carrying a "already enrolled in another trial"
 * flag. This file adds a small, illustrative, per-site SAMPLE of individual
 * synthetic patient rows (Patient ID / Disease / Age / named comorbidity
 * flags / Trial Status: Available or Enrolled) so requirement #1
 * ("Eliminate Patients Already Enrolled in Another Trial") has a literal
 * patient-level demonstration behind it instead of only a population-wide
 * percentage.
 *
 * WHY A SAMPLE, NOT THE FULL POPULATION: a site's real gross-eligible count
 * can run into the thousands or tens of thousands. Materializing one JSON
 * record per eligible patient would be an enormous payload for a screen
 * that can only ever display a handful of rows at once, with no benefit —
 * so this generates a small deterministic sample (SAMPLE_SIZE rows) instead.
 * The sample's Available/Enrolled MIX is generated using the exact same
 * probability (`enrolledFraction`, i.e. this site's recruitmentRateAssumed)
 * already used to compute the site's real, full-scale
 * alreadyEnrolledPatients/netAvailablePatients split — so the sample is
 * representative of that ratio, not a separate, disconnected random number.
 * The full-scale Total Eligible / Already Enrolled / Available COUNTS shown
 * elsewhere in the app come from that same rate applied to the full
 * grossEligiblePatients figure (see liveMapData.ts), not from counting this
 * 25-row sample.
 *
 * Every value here (age, comorbidity flags, which patients are "Enrolled")
 * is FABRICATED — deterministic seeded-random, exactly like every other
 * synthetic file in this project (same mulberry32-style generator as
 * syntheticPopulation.ts and syntheticSiteCost.ts) — standing in for real
 * per-patient EHR/claims/CTMS/enrollment data that has no live public
 * source. Never presented as real patient records; every caller must keep
 * labeling this "synthetic"/"illustrative."
 *
 * Comorbidity flag names deliberately match the specific disease labels the
 * LLM eligibility-filter feature already extracts (see llm/client.ts's
 * estimateEligibilityFilterImpact prompt: "Chronic kidney disease", "Liver
 * disease", "Heart disease", "Type 1 or type 2 diabetes") so the two
 * features describe the same real-world concepts consistently, even though
 * they are not (yet) cross-wired to filter against each other.
 */

export interface SyntheticPatientRecord {
  patientId: string;
  /** The indication this site's search was run for — same value on every row in a given sample. */
  disease: string;
  age: number;
  kidneyDisease: boolean;
  liverDisease: boolean;
  heartDisease: boolean;
  diabetes: boolean;
  /** "Enrolled" = fabricated as already enrolled in another trial for this indication; "Available" = fabricated as not currently enrolled elsewhere. */
  trialStatus: "Available" | "Enrolled";
}

const SAMPLE_SIZE = 25;
const MIN_AGE = 18;
const MAX_AGE = 80;

// Same mulberry32-style deterministic PRNG used elsewhere in this project
// (syntheticPopulation.ts, syntheticSiteCost.ts) — the same seed always
// produces the same sample, across requests and process restarts, rather
// than a different fabricated sample every time someone searches.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Builds a deterministic, illustrative sample of patient-level records for
 * one site. `enrolledFraction` should be the same recruitmentRateAssumed
 * already computed for this site in liveMapData.ts, so the sample's
 * Available/Enrolled split visually matches the real counts shown alongside
 * it instead of looking like an unrelated number.
 */
export function buildSyntheticPatientSample(
  siteId: string,
  disease: string,
  enrolledFraction: number,
): SyntheticPatientRecord[] {
  const rand = seededRandom(
    `patient-sample|${siteId}|${disease.trim().toLowerCase()}`,
  );
  const clampedFraction = Math.max(0, Math.min(1, enrolledFraction));
  const records: SyntheticPatientRecord[] = [];
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const age = Math.round(MIN_AGE + rand() * (MAX_AGE - MIN_AGE));
    records.push({
      patientId: `P${(i + 1).toString().padStart(3, "0")}`,
      disease,
      age,
      kidneyDisease: rand() < 0.12,
      liverDisease: rand() < 0.08,
      heartDisease: rand() < 0.15,
      diabetes: rand() < 0.2,
      trialStatus: rand() < clampedFraction ? "Enrolled" : "Available",
    });
  }
  return records;
}
