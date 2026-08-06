import xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type {
  Store,
  RegionRow,
  SiteRow,
  EvaluationRow,
  RiskRow,
  RiskLevel,
  RiskMatrix,
  TrialRequirementRow,
} from "./types.js";
import type { ExtendedEvaluationRow } from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function findExcelFile(): string {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    // Ignore Excel's lock files, which appear as ~$Name.xlsx while the
    // workbook is open and would otherwise be picked as the dataset.
    .filter((f) => !f.startsWith("~$"));
  if (files.length === 0) {
    throw new Error(
      `No .xlsx file found in ${DATA_DIR}. Put the dataset there first.`,
    );
  }
  // Prefer the enriched build (scripts/build-dataset.ts) when it's present.
  // This used to take files[0], which is alphabetical — so dropping
  // "..._v2.xlsx" next to the original silently kept loading the original,
  // and none of the new KPI columns or Trial_Requirements would appear.
  const enriched = files.find((f) => /_v2\.xlsx$/i.test(f));
  return path.join(DATA_DIR, enriched ?? files[0]);
}

// FALLBACK ONLY — the live mapping now comes from the Trial_Requirements
// sheet's "Required Specialty" column (see buildSpecialtyMap below).
//
// This map is kept for workbooks that predate that sheet, so an older
// dataset still loads. It is the thing that used to break: pipeline.ts
// rejects any indication missing from the map even though it's a valid
// dropdown option, and the map once listed only 6 of the 24 indications,
// so 18 of them failed with a confusing "unknown indication" error. Reading
// the mapping from data removes that whole class of bug — add an indication
// to the workbook and the backend picks it up with no code change.
const FALLBACK_INDICATION_TO_SPECIALTY: Record<string, string> = {
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
 * Live indication -> therapeutic area mapping, populated from
 * Trial_Requirements at load time. Exported as a mutable binding rather than
 * a function so existing `INDICATION_TO_SPECIALTY[indication]` call sites in
 * pipeline.ts / regionPredictor.ts / server.ts keep working unchanged.
 *
 * Populated by loadStore(). It starts as the fallback so that anything
 * reading it before the first load still gets a usable map.
 */
export const INDICATION_TO_SPECIALTY: Record<string, string> = {
  ...FALLBACK_INDICATION_TO_SPECIALTY,
};

function buildSpecialtyMap(requirements: TrialRequirementRow[]): void {
  if (requirements.length === 0) return; // older workbook — keep the fallback

  for (const key of Object.keys(INDICATION_TO_SPECIALTY)) {
    delete INDICATION_TO_SPECIALTY[key];
  }
  for (const r of requirements) {
    const indication = r.Indication;
    const specialty = r["Required Specialty"];
    if (indication && specialty)
      INDICATION_TO_SPECIALTY[indication] = specialty;
  }
}

let cachedStore: Store | null = null;

export function loadStore({ force = false }: { force?: boolean } = {}): Store {
  if (cachedStore && !force) return cachedStore;

  const filePath = findExcelFile();
  const wb = xlsx.readFile(filePath);

  function sheetJson<T>(sheetName: string, range?: string): T[] {
    const sheet = wb.Sheets[sheetName];
    if (!sheet)
      throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
    return xlsx.utils.sheet_to_json<T>(sheet, { defval: null, range });
  }

  // No fixed `range` here on purpose: these used to be hardcoded to
  // "A1:H301" / "A1:K301" / "A1:L1801" (300 sites, 1,800 risk records),
  // which silently truncated the dataset once it was regenerated with 600
  // sites / 3,600 risk records — half of every sheet (sites S-0301+ and
  // their risk/evaluation rows) was being dropped on every load, which is
  // also why some indications (e.g. Parkinson's Disease) could 404 on
  // "no candidate sites found" even after being a valid indication.
  // Omitting `range` lets the library read each sheet's actual used range.
  const regionData = sheetJson<RegionRow>("Region_Data");
  const sites = sheetJson<SiteRow>("Candidate_Sites");
  const evaluations = sheetJson<ExtendedEvaluationRow>("Site_Evaluation");
  const risks = sheetJson<RiskRow>("Risk_Register");

  // Trial_Requirements is optional: the sheet is documented in the workbook
  // README but was absent from the original file, so a dataset without it
  // must still load rather than throwing at startup.
  const requirements = wb.Sheets["Trial_Requirements"]
    ? sheetJson<TrialRequirementRow>("Trial_Requirements")
    : [];
  buildSpecialtyMap(requirements);

  // One requirements row per indication for Stage 1 to filter against. The
  // sheet holds 24 headline trials plus 360 cohort variants; the headline
  // row is the one that describes the trial as a whole, so prefer it and
  // fall back to the first variant if a disease has no headline row.
  const requirementByIndication = new Map<string, TrialRequirementRow>();
  for (const r of requirements) {
    const existing = requirementByIndication.get(r.Indication);
    if (
      !existing ||
      (r["Trial Type"] === "Headline" && existing["Trial Type"] !== "Headline")
    ) {
      requirementByIndication.set(r.Indication, r);
    }
  }

  // Risk_Matrix is a 3x3 Likelihood-by-Impact grid whose first column is the
  // Likelihood label and whose header row is the Impact labels. Read it with
  // header:1 (raw rows) rather than sheet_to_json's object mode, since the
  // corner cell ("Likelihood \ Impact") isn't a usable property name. This
  // is what lets the UI explain *why* a record is rated the way it is
  // instead of asserting the rating as a bare fact.
  const matrixRows = xlsx.utils.sheet_to_json<(string | null)[]>(
    wb.Sheets["Risk_Matrix"],
    { header: 1, defval: null },
  );
  const riskMatrix: RiskMatrix = {} as RiskMatrix;
  if (matrixRows.length > 1) {
    const impactHeaders = (matrixRows[0].slice(1) as RiskLevel[]) || [];
    for (const row of matrixRows.slice(1)) {
      const likelihood = row[0] as RiskLevel | null;
      if (!likelihood) continue;
      riskMatrix[likelihood] = {} as Record<RiskLevel, RiskLevel>;
      impactHeaders.forEach((impact, i) => {
        const cell = row[i + 1] as RiskLevel | null;
        if (impact && cell) riskMatrix[likelihood][impact] = cell;
      });
    }
  }

  const evalBySiteId = new Map<string, EvaluationRow>(
    evaluations.map((e) => [e["Site ID"], e]),
  );
  const risksBySiteId = new Map<string, RiskRow[]>();
  for (const r of risks) {
    const list = risksBySiteId.get(r["Site ID"]) || [];
    list.push(r);
    risksBySiteId.set(r["Site ID"], list);
  }

  // Dedupe (Indication, Region, Country) combos so the frontend's Region /
  // Country Selection input has one entry per real option instead of one
  // per Region_Data row.
  const seenOptions = new Set<string>();
  const regionOptions = regionData.reduce<Store["regionOptions"]>((acc, r) => {
    const key = `${r.Indication}||${r.Region}||${r.Country}`;
    if (!seenOptions.has(key)) {
      seenOptions.add(key);
      acc.push({
        indication: r.Indication,
        region: r.Region,
        country: r.Country,
      });
    }
    return acc;
  }, []);

  cachedStore = {
    filePath,
    regionData,
    sites,
    evaluations,
    risks,
    riskMatrix,
    evalBySiteId,
    risksBySiteId,
    requirements,
    requirementByIndication,
    indications: [...new Set(regionData.map((r) => r.Indication))],
    regions: [...new Set(regionData.map((r) => r.Region))],
    regionOptions,
  };

  return cachedStore;
}
