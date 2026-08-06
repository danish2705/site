export interface TrialForm {
  indication: string;
  phase: string;
  sampleSize: number;
  durationMonths: number;
  budgetTier: string;
  // Region / Country Selection input (multi-select). Each entry is a
  // composite "Region||Country" key matching one of meta.regionOptions
  // (filtered to the current indication). Empty = let the pipeline
  // auto-pick the best-fit region for the indication.
  regions: string[];
}

// One selectable (Indication, Region, Country) combination for the
// Region / Country Selection input.
export interface RegionOption {
  indication: string;
  region: string;
  country: string;
}

export interface MetaResponse {
  indications: string[];
  regions: string[];
  regionOptions: RegionOption[];
  specialties: Record<string, string>;
}

export type StageStatus = "pending" | "in-progress" | "complete";

export interface StageState {
  status: StageStatus;
  detail: string | null;
  data: unknown;
}

export type StagesMap = Record<number, StageState>;

// A single Risk_Register record, rendered as one row in a risk register
// table rather than folded into an aggregate count/badge.
export interface RiskRecord {
  riskId: string;
  siteId: string;
  category: string;
  description: string;
  likelihood: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
  overallRisk: "Low" | "Medium" | "High";
  dateIdentified: string;
  status: string;
  mitigationPlan: string;
  owner: string;
  riskScore: number;
}

// Stage 6 ("AI Risk Assessment") output: one row per candidate site
// (before ranking narrows to the top 10), each with its full risk register.
export interface RiskAssessmentRow {
  siteId: string;
  siteName: string;
  region: string;
  overallRisk: "Low" | "Medium" | "High";
  highRiskCount: number;
  mediumRiskCount: number;
  riskRecords: RiskRecord[];
}

export interface RankingRow {
  rank: number;
  siteId: string;
  siteName: string;
  region: string;
  suitabilityScore: number;
  riskLevel: "Low" | "Medium" | "High";
  highRiskCount: number;
}

export interface FinalResult {
  region: string;
  country: string;
  estimatedPatients: number;
  recommendedSite: string;
  siteId: string;
  suitabilityScore: number;
  riskLevel: "Low" | "Medium" | "High";
  highRiskCount: number;
  text: string;
}

// Payload shape of each "stage" SSE event sent by the backend
export interface StageEventPayload {
  stage: number;
  name: string;
  status: StageStatus;
  detail?: string;
  data?: unknown;
  llm?: string;
}
