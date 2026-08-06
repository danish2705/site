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
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function findExcelFile(): string {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (files.length === 0) {
    throw new Error(
      `No .xlsx file found in ${DATA_DIR}. Put the dataset there first.`,
    );
  }
  return path.join(DATA_DIR, files[0]);
}

// Every indication in Region_Data (24 total, matching the dataset's README:
// "24 distinct diseases across 12 therapeutic areas") must have an entry
// here — pipeline.ts rejects any indication missing from this map, even
// though it's a perfectly valid option in the dropdown/dataset. This used
// to only list 6 of the 24, so selecting any of the other 18 (e.g.
// "Parkinson's Disease") failed with a confusing "unknown indication"
// error despite being shown as valid. Mapping derived from each disease's
// "Required Infrastructure" clinical department in Trial_Requirements,
// cross-checked against the 12 real Therapeutic Area values used in
// Candidate_Sites.
export const INDICATION_TO_SPECIALTY: Record<string, string> = {
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
  const evaluations = sheetJson<EvaluationRow>("Site_Evaluation");
  const risks = sheetJson<RiskRow>("Risk_Register");

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
    indications: [...new Set(regionData.map((r) => r.Indication))],
    regions: [...new Set(regionData.map((r) => r.Region))],
    regionOptions,
  };

  return cachedStore;
}
