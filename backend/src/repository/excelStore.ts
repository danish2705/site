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
} from "../types.js";
import type { ExtendedEvaluationRow } from "../pipeline/scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findDataDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "data");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `No data/ directory found above ${__dirname}. Expected backend/data with the dataset .xlsx inside.`,
  );
}

function findExcelFile(): string {
  const DATA_DIR = findDataDir();
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .filter((f) => !f.startsWith("~$"));
  if (files.length === 0) {
    throw new Error(
      `No .xlsx file found in ${DATA_DIR}. Put the dataset there first.`,
    );
  }
  const enriched = files.find((f) => /_v2\.xlsx$/i.test(f));
  return path.join(DATA_DIR, enriched ?? files[0]);
}

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

  const regionData = sheetJson<RegionRow>("Region_Data");
  const sites = sheetJson<SiteRow>("Candidate_Sites");
  const evaluations = sheetJson<ExtendedEvaluationRow>("Site_Evaluation");
  const risks = sheetJson<RiskRow>("Risk_Register");
  const requirements = wb.Sheets["Trial_Requirements"]
    ? sheetJson<TrialRequirementRow>("Trial_Requirements")
    : [];
  buildSpecialtyMap(requirements);

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
