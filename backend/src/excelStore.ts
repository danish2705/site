import xlsx from "xlsx";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { Store, RegionRow, SiteRow, EvaluationRow, RiskRow } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function findExcelFile(): string {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (files.length === 0) {
    throw new Error(`No .xlsx file found in ${DATA_DIR}. Put the dataset there first.`);
  }
  return path.join(DATA_DIR, files[0]);
}

export const INDICATION_TO_SPECIALTY: Record<string, string> = {
  "Type 2 Diabetes": "Endocrinology",
  "Breast Cancer (HER2+)": "Oncology",
  "Hypertension": "Cardiology",
  "Alzheimer's Disease (Early-stage)": "Neurology",
  "HIV (Treatment-naive)": "Infectious Disease",
  "Asthma (Moderate-Severe)": "Pulmonology",
};

let cachedStore: Store | null = null;

export function loadStore({ force = false }: { force?: boolean } = {}): Store {
  if (cachedStore && !force) return cachedStore;

  const filePath = findExcelFile();
  const wb = xlsx.readFile(filePath);

  function sheetJson<T>(sheetName: string, range?: string): T[] {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
    return xlsx.utils.sheet_to_json<T>(sheet, { defval: null, range });
  }

  const regionData = sheetJson<RegionRow>("Region_Data");
  const sites = sheetJson<SiteRow>("Candidate_Sites", "A1:H301"); // header + 300 site rows
  const evaluations = sheetJson<EvaluationRow>("Site_Evaluation", "A1:K301"); // header + 300 rows
  const risks = sheetJson<RiskRow>("Risk_Register", "A1:L1801"); // header + 1800 rows

  const evalBySiteId = new Map<string, EvaluationRow>(evaluations.map((e) => [e["Site ID"], e]));
  const risksBySiteId = new Map<string, RiskRow[]>();
  for (const r of risks) {
    const list = risksBySiteId.get(r["Site ID"]) || [];
    list.push(r);
    risksBySiteId.set(r["Site ID"], list);
  }

  cachedStore = {
    filePath,
    regionData,
    sites,
    evaluations,
    risks,
    evalBySiteId,
    risksBySiteId,
    indications: [...new Set(regionData.map((r) => r.Indication))],
    regions: [...new Set(regionData.map((r) => r.Region))],
  };

  return cachedStore;
}
