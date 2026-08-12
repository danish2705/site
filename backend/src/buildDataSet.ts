import xlsx from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import {
  scoreSites,
  DECK_WEIGHTS,
  type ExtendedEvaluationRow,
} from "./pipeline/scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(
  __dirname,
  "..",
  "data",
  "Clinical_Trial_Site_Selection.xlsx",
);
const OUT = path.join(
  __dirname,
  "..",
  "data",
  "Clinical_Trial_Site_Selection_v2.xlsx",
);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260806);

let spare: number | null = null;
function gauss(mean = 0, sd = 1): number {
  if (spare !== null) {
    const v = spare;
    spare = null;
    return mean + sd * v;
  }
  let u = 0;
  let v = 0;
  let s = 0;
  do {
    u = rand() * 2 - 1;
    v = rand() * 2 - 1;
    s = u * u + v * v;
  } while (s === 0 || s >= 1);
  const f = Math.sqrt((-2 * Math.log(s)) / s);
  spare = v * f;
  return mean + sd * u * f;
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const clip = (n: number, lo: number, hi: number, dp = 1) =>
  round(Math.max(lo, Math.min(hi, n)), dp);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

/** Reads a cell as a number, treating blanks/non-numerics as absent. */
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

const wb = xlsx.readFile(SRC, { cellDates: true });

type Row = Record<string, unknown>;
const sheet = (name: string): Row[] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found in ${SRC}`);
  return xlsx.utils.sheet_to_json<Row>(ws, { defval: null });
};

const sites = sheet("Candidate_Sites");
const evals = sheet("Site_Evaluation");
const regionData = sheet("Region_Data");

const siteById = new Map(sites.map((s) => [s["Site ID"] as string, s]));

interface RegionCtx {
  cost: number;
  weeks: number;
  competing: number;
}
const regionCtx = new Map<string, RegionCtx>();
{
  const acc = new Map<
    string,
    { cost: number[]; weeks: number[]; comp: number[] }
  >();
  for (const r of regionData) {
    const key = r.Region as string;
    if (!acc.has(key)) acc.set(key, { cost: [], weeks: [], comp: [] });
    const a = acc.get(key)!;
    const c = n(r["Avg Cost per Patient (USD)"]);
    const w = n(r["Regulatory Approval Time (weeks)"]);
    const k = n(r["Active Competing Trials"]);
    if (c !== null) a.cost.push(c);
    if (w !== null) a.weeks.push(w);
    if (k !== null) a.comp.push(k);
  }
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : 0;
  for (const [k, a] of acc) {
    regionCtx.set(k, {
      cost: mean(a.cost),
      weeks: mean(a.weeks),
      competing: mean(a.comp),
    });
  }
}

const COMPLEX_TA = new Set([
  "Oncology",
  "Neurology",
  "Gastroenterology",
  "Hematology",
]);

const HOSP_COST_FACTOR: Record<string, number> = {
  "Academic Medical Center": 1.22,
  "Tertiary Hospital": 1.05,
  "Community Hospital": 0.86,
  "Private Research Clinic": 1.12,
  "Specialty Center": 1.0,
};
const HOSP_CATCHMENT: Record<string, number> = {
  "Academic Medical Center": 3_200_000,
  "Tertiary Hospital": 2_100_000,
  "Community Hospital": 850_000,
  "Private Research Clinic": 1_150_000,
  "Specialty Center": 1_600_000,
};

const maxPrior = Math.max(...evals.map((e) => n(e["Prior Trials Count"]) ?? 0));
const meanEnroll = (() => {
  const xs = evals
    .map((e) => n(e["Historical Enrollment Rate (pts/month)"]))
    .filter((x): x is number => x !== null);
  return xs.reduce((p, q) => p + q, 0) / xs.length;
})();

const enriched: ExtendedEvaluationRow[] = evals.map((e) => {
  const site = siteById.get(e["Site ID"] as string) ?? {};
  const ctx = regionCtx.get(site.Region as string) ?? {
    cost: 3000,
    weeks: 12,
    competing: 3,
  };
  const hospType = (site["Hospital Type"] as string) ?? "";
  const complexity = COMPLEX_TA.has(site["Therapeutic Area"] as string) ? 1 : 0;
  const inv = n(e["Investigator Experience Score (0-10)"]);
  const dq = n(e["Data Quality Score (0-100)"]);
  const staff = n(e["Staff Availability Score (0-10)"]);
  const infra = n(e["Infrastructure Readiness (%)"]);
  const enroll = n(e["Historical Enrollment Rate (pts/month)"]);
  const prior = (n(e["Prior Trials Count"]) ?? 0) / maxPrior;

  const invN = inv === null ? null : inv / 10;
  const dqN = dq === null ? null : dq / 100;
  const staffN = staff === null ? null : staff / 10;
  const infraN = infra === null ? null : infra / 100;

  // --- 1) performance KPIs ---
  const screenFailure =
    invN === null
      ? null
      : clip(
          28 + 12 * complexity + 0.8 * ctx.competing - 18 * invN + gauss(0, 4),
          5,
          72,
        );
  const protocolDeviation =
    dqN === null
      ? null
      : clip(14 - 11 * dqN - 2.5 * prior + gauss(0, 1.6), 0.3, 22);
  const timeToFpi =
    enroll === null
      ? null
      : clip(
          95 -
            1.6 * enroll -
            25 * (infraN ?? 0.6) +
            2.2 * ctx.weeks +
            gauss(0, 9),
          14,
          240,
          0,
        );
  const startUp =
    infraN === null
      ? null
      : clip(
          55 +
            4.0 * ctx.weeks -
            30 * infraN -
            20 * (staffN ?? 0.6) +
            gauss(0, 10),
          21,
          260,
          0,
        );

  // --- 2) data-quality KPIs ---
  const queryRate =
    dqN === null
      ? null
      : clip(32 - 26 * dqN + 4 * complexity + gauss(0, 3), 1, 60);
  const queryResolution =
    staffN === null
      ? null
      : clip(22 - 12 * staffN - 6 * (dqN ?? 0.6) + gauss(0, 2.5), 1, 45);
  const dataEntryLag =
    staffN === null
      ? null
      : clip(18 - 9 * staffN - 7 * (dqN ?? 0.6) + gauss(0, 2.2), 0.5, 40);

  // --- 3) staff / compliance ---
  const staffTurnover =
    staffN === null ? null : clip(30 - 22 * staffN + gauss(0, 3.5), 2, 55);
  const gcpCurrent =
    dqN === null
      ? null
      : clip(
          55 + 42 * dqN + (site.Accreditation === "Yes" ? 6 : 0) + gauss(0, 5),
          40,
          100,
          0,
        );

  // --- 4) cost / population ---
  const costPerPatient = Math.round(
    ctx.cost * (HOSP_COST_FACTOR[hospType] ?? 1.0) * (1 + gauss(0, 0.11)),
  );
  const catchment = Math.max(
    120_000,
    Math.round(
      ((HOSP_CATCHMENT[hospType] ?? 1_500_000) * (1 + gauss(0, 0.3))) / 1000,
    ) * 1000,
  );
  const diversity = clip(
    46 +
      (hospType === "Academic Medical Center" ? 16 : 0) +
      10 * Math.max(-1, Math.min(1, Math.log10(catchment / 1e6))) +
      gauss(0, 9),
    12,
    98,
    0,
  );

  return {
    ...(e as unknown as ExtendedEvaluationRow),
    "Screen Failure Rate (%)": screenFailure,
    "Protocol Deviation Rate (per 100 visits)": protocolDeviation,
    "Time to FPI (days)": timeToFpi,
    "Site Start-up Time (days)": startUp,
    "Query Rate (per 100 CRF pages)": queryRate,
    "Query Resolution Time (days)": queryResolution,
    "Data Entry Lag (days)": dataEntryLag,
    "Staff Turnover (%)": staffTurnover,
    "GCP Certification Current (%)": gcpCurrent,
    "Site Cost per Patient (USD)": costPerPatient,
    "Catchment Population": catchment,
    "Diversity Index (0-100)": diversity,
  };
});

// ------------------------------------------------- score via scoring.ts
// Cost is scored relative to the peer set, so this must see all sites at
// once — same call the pipeline makes.
const scored = scoreSites(enriched, DECK_WEIGHTS);
const scoreById = new Map(scored.map((s) => [s.siteId, s]));

const evalOut = enriched.map((row) => {
  const s = scoreById.get(row["Site ID"])!;
  return {
    ...row,
    "Recruitment Score (0-100)":
      s.components.recruitment === null
        ? null
        : round(s.components.recruitment),
    "Quality Score (0-100)":
      s.components.quality === null ? null : round(s.components.quality),
    "Retention Score (0-100)":
      s.components.retention === null ? null : round(s.components.retention),
    "Diversity Score (0-100)":
      s.components.diversity === null ? null : round(s.components.diversity),
    "Cost Score (0-100)":
      s.components.cost === null ? null : round(s.components.cost),
    "Site Score (0-100)": s.score,
    "Model Coverage (%)": s.coverage,
    "Data Completeness (%)": s.completeness,
    "Score Confidence": s.confidence,
  };
});

wb.Sheets["Site_Evaluation"] = xlsx.utils.json_to_sheet(evalOut);

// ------------------------------------------- Trial_Requirements (missing)
const SPECIALTY: Record<string, string> = {
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

const INFRA: Record<string, string> = {
  Endocrinology: "Endocrine clinic; central lab; -70C sample storage",
  Oncology: "Oncology day-care unit; imaging (CT/MRI); GCP pharmacy; biobank",
  Cardiology: "Cardiac cath lab; ECG/Holter; echo suite",
  Neurology: "Neuroimaging (MRI); cognitive testing room; EEG",
  "Infectious Disease":
    "BSL-2 lab; isolation capacity; viral load assay access",
  Pulmonology: "Spirometry/PFT lab; nebulisation room",
  Rheumatology: "Joint assessment suite; DAS28-trained assessor; imaging",
  Dermatology: "Photography suite; punch-biopsy capability",
  Gastroenterology: "Endoscopy suite; histopathology",
  Nephrology: "Dialysis access; renal function lab panel",
  Psychiatry: "Rated-scale interview rooms; trained rater; safety monitoring",
  Hematology: "Transfusion service; haemoglobin electrophoresis; apheresis",
};

const TAGS = [
  "Adult (18-64)",
  "Elderly (65+)",
  "Treatment-naive",
  "Treatment-experienced",
  "Female-only cohort",
  "Male-only cohort",
  "Paediatric-adjacent (16-21)",
  "Severe/advanced stage",
  "Mild-moderate stage",
  "Comorbid CKD",
  "Comorbid cardiovascular",
  "Biomarker-positive subgroup",
  "Underrepresented-population enrichment",
  "Rural/low-access catchment",
  "Open-label extension",
];
const PHASES = ["Phase I", "Phase II", "Phase IIb", "Phase III", "Phase IV"];
const BASE_N: Record<string, number> = {
  "Phase I": 60,
  "Phase II": 180,
  "Phase IIb": 260,
  "Phase III": 600,
  "Phase IV": 900,
};
const BUDGETS = ["Low", "Mid", "High"];

function quantile(values: (number | null)[], p: number): number {
  const xs = values
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const i = (xs.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? xs[lo] : xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
}

const col = (name: keyof ExtendedEvaluationRow) =>
  enriched.map((e) => n(e[name] as unknown));

const Q = {
  enroll: (p: number) =>
    quantile(col("Historical Enrollment Rate (pts/month)"), p),
  dropout: (p: number) => quantile(col("Dropout Rate (%)"), p),
  quality: (p: number) => quantile(col("Data Quality Score (0-100)"), p),
  screenFail: (p: number) => quantile(col("Screen Failure Rate (%)"), p),
};

function thresholdAt(
  q: (p: number) => number,
  basePercentile: number,
  strict: boolean,
  direction: "min" | "max",
): number {
  const shift = (strict ? 0.08 : 0) * (direction === "min" ? 1 : -1);
  const jitter = (rand() - 0.5) * 0.16;
  const p = Math.max(0.05, Math.min(0.95, basePercentile + shift + jitter));
  return round(q(p));
}

const requirements: Row[] = [];
let tid = 1;
for (const [indication, specialty] of Object.entries(SPECIALTY)) {
  const heavy = ["Oncology", "Neurology", "Hematology"].includes(specialty);
  for (let k = 0; k < 16; k++) {
    // 1 headline + 15 variants per disease = 384 rows, matching the README.
    const phase = k === 0 ? "Phase III" : pick(PHASES);
    // Phase III / headline protocols are genuinely fussier about site quality.
    const strict = phase === "Phase III" || k === 0;
    requirements.push({
      "Trial ID": `T-${String(tid).padStart(3, "0")}`,
      Indication: indication,
      "Required Specialty": specialty,
      "Trial Type": k === 0 ? "Headline" : "Variant",
      "Cohort / Subgroup Tag": k === 0 ? "All-comers" : pick(TAGS),
      Phase: phase,
      "Target Sample Size": Math.round(BASE_N[phase] * (0.7 + rand() * 0.65)),
      "Duration (months)": Math.round(
        clip(gauss(heavy ? 20 : 15, 5), 6, 48, 0),
      ),
      "Budget Tier": heavy && k === 0 ? "High" : pick(BUDGETS),
      "Min Enrollment Rate (pts/month)": thresholdAt(
        Q.enroll,
        0.3,
        strict,
        "min",
      ),
      "Max Acceptable Dropout (%)": thresholdAt(Q.dropout, 0.75, strict, "max"),
      "Min Data Quality Score": Math.round(
        thresholdAt(Q.quality, 0.3, strict, "min"),
      ),
      "Max Acceptable Screen Failure (%)": Math.round(
        thresholdAt(Q.screenFail, 0.75, strict, "max"),
      ),
      "Accreditation Required": rand() < 0.62 ? "Yes" : "Preferred",
      "Required Infrastructure": INFRA[specialty],
    });
    tid++;
  }
}

const trWs = xlsx.utils.json_to_sheet(requirements);
xlsx.utils.book_append_sheet(wb, trWs, "Trial_Requirements");
// Put it right after README, where the README's sheet guide expects it.
wb.SheetNames = [
  "README",
  "Trial_Requirements",
  ...wb.SheetNames.filter((s) => s !== "README" && s !== "Trial_Requirements"),
];

const weightsWs = xlsx.utils.json_to_sheet([
  {
    Component: "Recruitment",
    Weight: DECK_WEIGHTS.recruitment,
    "Driver KPIs":
      "Enrollment rate, screen failure, time to FPI, start-up time",
  },
  {
    Component: "Quality",
    Weight: DECK_WEIGHTS.quality,
    "Driver KPIs":
      "Data quality, query rate/resolution, data entry lag, protocol deviations",
  },
  {
    Component: "Retention",
    Weight: DECK_WEIGHTS.retention,
    "Driver KPIs": "Dropout rate, staff turnover",
  },
  {
    Component: "Diversity",
    Weight: DECK_WEIGHTS.diversity,
    "Driver KPIs": "Diversity index of the site catchment",
  },
  {
    Component: "Cost",
    Weight: DECK_WEIGHTS.cost,
    "Driver KPIs": "Site cost per patient, relative to the peer set",
  },
  { Component: "", Weight: null, "Driver KPIs": "" },
  {
    Component: "NOTE",
    Weight: null,
    "Driver KPIs":
      "Reference only. Live weights are DECK_WEIGHTS in src/scoring.ts — edit there and re-run this script.",
  },
]);
xlsx.utils.book_append_sheet(wb, weightsWs, "Scoring_Weights");

xlsx.writeFile(wb, OUT);

const withGaps = scored.filter((s) => s.caveats.length > 0).length;
console.log(
  `Site_Evaluation:      ${evalOut.length} rows, ${Object.keys(evalOut[0]).length} columns`,
);
console.log(`Trial_Requirements:   ${requirements.length} rows`);
console.log(`Sites with data gaps: ${withGaps} of ${scored.length}`);
console.log(`Saved:                ${OUT}`);
console.log("No recalculation needed — values, not formulas.");
