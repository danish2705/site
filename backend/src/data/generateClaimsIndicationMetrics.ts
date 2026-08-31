import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Deliberately a self-contained COPY of
// repository/excelStore.ts's FALLBACK_INDICATION_TO_SPECIALTY, not an
// import from it — importing that module pulls in the `xlsx` package and
// its file-system probing (findExcelFile/findDataDir), neither of which
// this standalone generator script needs just to get 24 label->specialty
// pairs. If the app's known-indication list ever changes, update both
// places.
const INDICATION_TO_SPECIALTY: Record<string, string> = {
  "Type 2 Diabetes": "Endocrinology",
  "Obesity (BMI>30)": "Endocrinology",
  "Breast Cancer (HER2+)": "Oncology",
  "Non-Small Cell Lung Cancer": "Oncology",
  "Colorectal Cancer": "Oncology",
  "Prostate Cancer": "Oncology",
  Hypertension: "Cardiology",
  "Heart Failure (HFrEF)": "Cardiology",
  "Atrial Fibrillation": "Cardiology",
  "Alzheimer's Disease (Early-stage)": "Neurology",
  "Parkinson's Disease": "Neurology",
  "Multiple Sclerosis (Relapsing-Remitting)": "Neurology",
  "Epilepsy (Focal)": "Neurology",
  "HIV (Treatment-naive)": "Infectious Disease",
  "Tuberculosis (Drug-sensitive)": "Infectious Disease",
  "Chronic Hepatitis C": "Infectious Disease",
  "Asthma (Moderate-Severe)": "Pulmonology",
  COPD: "Pulmonology",
  "Rheumatoid Arthritis": "Rheumatology",
  "Psoriasis (Moderate-Severe)": "Dermatology",
  "Crohn's Disease": "Gastroenterology",
  "Chronic Kidney Disease (Stage 3-4)": "Nephrology",
  "Major Depressive Disorder": "Psychiatry",
  "Sickle Cell Disease": "Hematology",
};

/**
 * One-time authoring script for data/claimsIndicationMetrics.ts — NOT run by
 * the app itself. Run manually (`node --experimental-strip-types
 * data/generateClaimsIndicationMetrics.ts` from backend/src, or via ts-node)
 * whenever the numbers in claimsIndicationMetrics.ts need to be regenerated
 * or tuned, instead of hand-editing ~2,500 individual values.
 *
 * Produces Prevalence (per 100k) / Regulatory Approval Time (weeks) / Avg
 * Cost per Patient (USD) for every indication in INDICATION_TO_SPECIALTY
 * across every country in COUNTRIES below. A handful of indications
 * (Type 2 Diabetes, Chronic Kidney Disease, Heart Failure/Atrial
 * Fibrillation, Chronic Hepatitis C) partly ground their prevalence figure
 * in the existing FABRICATED claims_data_global_capped.json patient-flag
 * records; everything else is authored from plausible per-specialty/
 * per-country ranges, with a handful of real-world-informed skews (e.g.
 * Egypt's historically high Hepatitis C burden, Sub-Saharan Africa's HIV/
 * TB/Sickle Cell burden). See claimsIndicationMetrics.ts's own doc comment
 * for the same disclosure — none of this is real epidemiological,
 * regulatory, or cost data.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COUNTRIES = [
  "Argentina", "Australia", "Bangladesh", "Canada", "Chile", "China", "Colombia",
  "Czech Republic", "Egypt", "France", "Germany", "India", "Indonesia", "Israel",
  "Italy", "Japan", "Kenya", "Netherlands", "Nigeria", "Pakistan", "Peru",
  "Philippines", "Poland", "Romania", "Saudi Arabia", "South Africa",
  "South Korea", "Spain", "Sri Lanka", "Sweden", "Taiwan",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam",
] as const;

// Same mulberry32-style deterministic string -> PRNG already used elsewhere
// in this codebase (see data/syntheticPatients.ts / syntheticPopulation.ts)
// — kept identical so this generator follows the app's own convention
// rather than inventing a new one.
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

function randIn(seed: string, lo: number, hi: number): number {
  return lo + seededRandom(seed)() * (hi - lo);
}

// ---- Step 1: aggregate real flag rates per country from the existing claims file ----
interface ClaimsRecord {
  location: { country: string };
  diabetes?: boolean;
  kidneyDisease?: boolean;
  heartDisease?: boolean;
  liverDisease?: boolean;
}
interface ClaimsFile {
  records: ClaimsRecord[];
}

const CLAIMS_FILE = path.join(__dirname, "claims_data_global_capped.json");
console.error(`Loading ${CLAIMS_FILE} ...`);
const claims: ClaimsFile = JSON.parse(fs.readFileSync(CLAIMS_FILE, "utf-8"));

type Flag = "diabetes" | "kidneyDisease" | "heartDisease" | "liverDisease";
const FLAGS: Flag[] = ["diabetes", "kidneyDisease", "heartDisease", "liverDisease"];

const flagCounts = new Map<string, Record<Flag, number> & { n: number }>();
for (const country of COUNTRIES) {
  flagCounts.set(country, { diabetes: 0, kidneyDisease: 0, heartDisease: 0, liverDisease: 0, n: 0 });
}
for (const r of claims.records) {
  const entry = flagCounts.get(r.location.country);
  if (!entry) continue;
  entry.n += 1;
  for (const flag of FLAGS) {
    if (r[flag]) entry[flag] += 1;
  }
}

const flagRatePer100k = new Map<string, Record<Flag, number>>();
for (const [country, entry] of flagCounts) {
  const n = entry.n || 1;
  const rates = {} as Record<Flag, number>;
  for (const flag of FLAGS) {
    rates[flag] = Math.round((entry[flag] / n) * 100000);
  }
  flagRatePer100k.set(country, rates);
}

// ---- Step 2: regulatory approval time (weeks) per country — fixed tiers ----
const REG_TIER_FAST = new Set([
  "United States", "United Kingdom", "Germany", "France", "Netherlands",
  "Sweden", "Canada", "Australia", "Japan", "South Korea", "Israel",
]);
const REG_TIER_MED = new Set([
  "Spain", "Italy", "Poland", "Czech Republic", "China", "Taiwan",
  "United Arab Emirates", "Saudi Arabia", "Chile", "Argentina",
]);
// everything else falls into the slow tier

function regulatoryWeeksFor(country: string): number {
  const seed = `regulatory|${country}`;
  if (REG_TIER_FAST.has(country)) return Math.round(randIn(seed, 16, 26));
  if (REG_TIER_MED.has(country)) return Math.round(randIn(seed, 27, 38));
  return Math.round(randIn(seed, 39, 56));
}

const regulatoryByCountry = new Map<string, number>(COUNTRIES.map((c) => [c, regulatoryWeeksFor(c)]));

// ---- Step 3: cost-per-patient base (by specialty) and country multiplier ----
const SPECIALTY_BASE_COST: Record<string, number> = {
  Oncology: 35000, Neurology: 28000, Hematology: 30000,
  Nephrology: 18000, Cardiology: 15000, Gastroenterology: 16000,
  Rheumatology: 14000, Dermatology: 12000, Endocrinology: 10000,
  Pulmonology: 9000, "Infectious Disease": 7000, Psychiatry: 8000,
};
const COST_TIER_HIGH = new Set([
  "United States", "Germany", "United Kingdom", "France", "Netherlands",
  "Sweden", "Australia", "Japan", "Canada", "Israel",
]);
const COST_TIER_MED = new Set([
  "Spain", "Italy", "Poland", "Czech Republic", "South Korea", "Taiwan",
  "Saudi Arabia", "United Arab Emirates", "Chile", "China",
]);
// everything else -> low tier

function costMultiplierFor(country: string): number {
  const seed = `costmult|${country}`;
  if (COST_TIER_HIGH.has(country)) return randIn(seed, 0.9, 1.3);
  if (COST_TIER_MED.has(country)) return randIn(seed, 0.4, 0.7);
  return randIn(seed, 0.15, 0.35);
}

const costMultiplierByCountry = new Map<string, number>(COUNTRIES.map((c) => [c, costMultiplierFor(c)]));

// ---- Step 4: prevalence per 100k — base ranges per indication + real-world-informed skews ----
const PREVALENCE_BASE: Record<string, [number, number]> = {
  "Type 2 Diabetes": [6000, 11000],
  "Obesity (BMI>30)": [8000, 35000],
  "Breast Cancer (HER2+)": [15, 50],
  "Non-Small Cell Lung Cancer": [15, 45],
  "Colorectal Cancer": [25, 65],
  "Prostate Cancer": [30, 110],
  Hypertension: [20000, 38000],
  "Heart Failure (HFrEF)": [400, 1400],
  "Atrial Fibrillation": [800, 2800],
  "Alzheimer's Disease (Early-stage)": [150, 700],
  "Parkinson's Disease": [80, 280],
  "Multiple Sclerosis (Relapsing-Remitting)": [15, 90],
  "Epilepsy (Focal)": [150, 450],
  "HIV (Treatment-naive)": [50, 400],
  "Tuberculosis (Drug-sensitive)": [10, 100],
  "Chronic Hepatitis C": [100, 800],
  "Asthma (Moderate-Severe)": [2000, 5000],
  COPD: [2000, 5500],
  "Rheumatoid Arthritis": [300, 900],
  "Psoriasis (Moderate-Severe)": [500, 1400],
  "Crohn's Disease": [80, 350],
  "Chronic Kidney Disease (Stage 3-4)": [1000, 3000],
  "Major Depressive Disorder": [3000, 7500],
  "Sickle Cell Disease": [10, 80],
};

// Real-world-informed per-country multipliers for specific indications
// where the skew is well documented; every other (indication, country)
// pair just uses a mild seeded variation within its base range instead.
const PREVALENCE_COUNTRY_MULTIPLIER: Record<string, Record<string, number>> = {
  "Type 2 Diabetes": { "Saudi Arabia": 1.35, "United Arab Emirates": 1.3, "United States": 1.15, Kenya: 0.5, Nigeria: 0.45, "Sri Lanka": 0.6 },
  "Obesity (BMI>30)": { "United States": 1.3, "Saudi Arabia": 1.2, "United Arab Emirates": 1.15, Japan: 0.25, "South Korea": 0.3, Vietnam: 0.25, India: 0.35 },
  "Colorectal Cancer": { "United States": 1.2, "United Kingdom": 1.15, Australia: 1.25, Japan: 1.2, Nigeria: 0.4, Kenya: 0.4 },
  "Prostate Cancer": { "United States": 1.3, Sweden: 1.25, Australia: 1.2, China: 0.4, Vietnam: 0.35 },
  Hypertension: { Nigeria: 1.2, Kenya: 1.2, "South Africa": 1.15 },
  "Alzheimer's Disease (Early-stage)": { Japan: 1.35, Germany: 1.25, Italy: 1.25, Sweden: 1.2, Nigeria: 0.3, Kenya: 0.3, Pakistan: 0.35 },
  "Multiple Sclerosis (Relapsing-Remitting)": { Sweden: 1.8, "United Kingdom": 1.3, Canada: 1.4, Vietnam: 0.15, Indonesia: 0.15 },
  "Epilepsy (Focal)": { Nigeria: 1.3, Kenya: 1.3, India: 1.15, Pakistan: 1.2 },
  "HIV (Treatment-naive)": { "South Africa": 12, Kenya: 8, Nigeria: 6 },
  "Tuberculosis (Drug-sensitive)": { "South Africa": 6, India: 5, Indonesia: 4.5, Philippines: 4, Pakistan: 4, Bangladesh: 3.5, Nigeria: 3.5, Kenya: 3 },
  "Chronic Hepatitis C": { Egypt: 6 },
  "Asthma (Moderate-Severe)": { "United Kingdom": 1.3, Australia: 1.3 },
  COPD: { China: 1.3 },
  "Psoriasis (Moderate-Severe)": { Sweden: 1.2 },
  "Crohn's Disease": { "United States": 1.3, Canada: 1.35, Sweden: 1.25, India: 0.25, China: 0.25, Vietnam: 0.2, Indonesia: 0.2 },
  "Sickle Cell Disease": { Nigeria: 22, Kenya: 10, "South Africa": 4 },
};

const CLAIMS_GROUNDED_FLAG: Record<string, [Flag, number]> = {
  "Type 2 Diabetes": ["diabetes", 1.0],
  "Chronic Kidney Disease (Stage 3-4)": ["kidneyDisease", 0.6],
  "Heart Failure (HFrEF)": ["heartDisease", 0.3],
  "Atrial Fibrillation": ["heartDisease", 0.55],
  "Chronic Hepatitis C": ["liverDisease", 0.5],
};

function prevalenceFor(indication: string, country: string): number {
  const [lo, hi] = PREVALENCE_BASE[indication];
  const seed = `prevalence|${indication}|${country}`;
  const base = randIn(seed, lo, hi);
  const mult = PREVALENCE_COUNTRY_MULTIPLIER[indication]?.[country] ?? 1.0;
  let value = base * mult;

  const grounded = CLAIMS_GROUNDED_FLAG[indication];
  if (grounded) {
    const [flag, weight] = grounded;
    const claimsValue = (flagRatePer100k.get(country)?.[flag] ?? 0) * weight;
    // Blend the claims-derived figure with the authored figure (60/40)
    // rather than using either alone — grounds the number in the existing
    // fabricated-but-real-counted records where a matching flag exists,
    // while still respecting each indication's own plausible base range
    // instead of just inheriting the flag's raw rate.
    value = claimsValue * 0.6 + value * 0.4;
  }

  return Math.max(1, Math.round(value));
}

function costFor(indication: string, country: string): number {
  const specialty = INDICATION_TO_SPECIALTY[indication];
  const base = SPECIALTY_BASE_COST[specialty];
  const jitter = randIn(`cost|${indication}|${country}`, 0.85, 1.15);
  const value = base * (costMultiplierByCountry.get(country) ?? 0.3) * jitter;
  return Math.round(value / 100) * 100; // round to nearest $100
}

// ---- Build the final lookup table ----
interface Entry {
  prevalencePer100k: number;
  regulatoryApprovalWeeks: number;
  avgCostPerPatientUsd: number;
}
const table: Record<string, Record<string, Entry>> = {};
for (const indication of Object.keys(INDICATION_TO_SPECIALTY)) {
  table[indication] = {};
  for (const country of COUNTRIES) {
    table[indication][country] = {
      prevalencePer100k: prevalenceFor(indication, country),
      regulatoryApprovalWeeks: regulatoryByCountry.get(country)!,
      avgCostPerPatientUsd: costFor(indication, country),
    };
  }
}

// ---- Write out data/claimsIndicationMetrics.ts directly ----
const header = `/**
 * Static, pre-authored reference table for Prevalence / Regulatory Approval
 * Time / Cost per Patient, covering the app's 24 known indications (see
 * repository/excelStore.ts's FALLBACK_INDICATION_TO_SPECIALTY) across all 35
 * countries in data/regionMap.ts.
 *
 * WHY THIS EXISTS: pipeline/liveRegionMetrics.ts normally asks an LLM for
 * these three numbers, one call per candidate region -- up to ~35 concurrent
 * calls when no region/country is pre-selected. For these 24 indications,
 * that wait is now skippable entirely: this table is checked FIRST, and the
 * LLM is only called as a fallback for any indication or country this table
 * doesn't cover.
 *
 * WHAT THIS IS, HONESTLY: still 100% fabricated, deterministic, illustrative
 * data -- not real epidemiological, regulatory, or cost figures. A few
 * indications (Type 2 Diabetes, Chronic Kidney Disease, Heart Failure/
 * Atrial Fibrillation, Chronic Hepatitis C) are partly grounded in the
 * existing FABRICATED claims_data_global_capped.json patient-flag records
 * (blended with an authored baseline). Every other indication's prevalence,
 * and every regulatory-time and cost figure, is authored from scratch using
 * plausible per-specialty/per-country ranges (with a handful of real-world-
 * informed skews, e.g. Egypt's historically high Hepatitis C burden,
 * Sub-Saharan Africa's HIV/TB/Sickle Cell burden) -- NOT derived from any
 * real claims, EHR, or epidemiological source. Regenerate via
 * generateClaimsIndicationMetrics.ts if these numbers ever need to change;
 * don't hand-edit individual values without updating the generator too, or
 * the two will drift apart.
 */

export interface ClaimsIndicationMetrics {
  prevalencePer100k: number;
  regulatoryApprovalWeeks: number;
  avgCostPerPatientUsd: number;
}

export const CLAIMS_INDICATION_METRICS: Record<string, Record<string, ClaimsIndicationMetrics>> = `;

const outPath = path.join(__dirname, "claimsIndicationMetrics.ts");
fs.writeFileSync(outPath, header + JSON.stringify(table, null, 2) + ";\n");

console.error(`Wrote ${Object.keys(table).length} indications x ${COUNTRIES.length} countries to ${outPath}`);
console.log(JSON.stringify(table["Type 2 Diabetes"]["India"], null, 2));
console.log(JSON.stringify(table["Sickle Cell Disease"]["Nigeria"], null, 2));
console.log(JSON.stringify(table["Chronic Hepatitis C"]["Egypt"], null, 2));
