export interface SyntheticPatientRecord {
  patientId: string;
  disease: string;
  age: number;
  kidneyDisease: boolean;
  liverDisease: boolean;
  heartDisease: boolean;
  diabetes: boolean;
  trialStatus: "Available" | "Enrolled";
}

const SAMPLE_SIZE = 25;
const MIN_AGE = 18;
const MAX_AGE = 80;

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
