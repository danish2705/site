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

// ---- AI Region Prediction (POST /api/predict-region) ----
// One scored region option shown in the prediction section's candidate
// table. Mirrors the backend's RegionCandidate.
export interface RegionCandidate {
  region: string;
  country: string;
  prevalence: number;
  regulatoryWeeks: number;
  competingTrials: number;
  avgCostPerPatient: number;
  siteCount: number;
  avgSuitability: number;
  bestSuitability: number;
  highRiskCount: number;
  highRiskPerSite: number;
  avgEnrollmentRate: number;
  estimatedPatients: number;
  monthsToEnroll: number | null;
  score: number;
}

export interface RegionAlternative {
  region: string;
  country: string;
  why: string;
}

export interface RegionPrediction {
  region: string;
  country: string;
  confidence: "Low" | "Medium" | "High";
  confidenceReason: string;
  rationale: string;
  keyFactors: string[];
  watchOuts: string[];
  alternatives: RegionAlternative[];
}

export interface RegionPredictionResponse {
  llm: string;
  indication: string;
  specialty: string;
  prediction: RegionPrediction;
  candidates: RegionCandidate[];
  excludedNoSites: number;
}

// A risk record that drove a site's rating, with its matrix derivation.
export interface RiskDriver {
  riskId: string;
  category: string;
  description: string;
  likelihood: "Low" | "Medium" | "High";
  impact: "Low" | "Medium" | "High";
  rating: "Low" | "Medium" | "High";
  status: string;
  active: boolean;
  derivation: string;
}

// Explains WHY a site is Low/Medium/High rather than just asserting it.
export interface RiskExplanation {
  level: "Low" | "Medium" | "High";
  rule: string;
  summary: string;
  totalRecords: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  activeAtLevel: number;
  drivers: RiskDriver[];
  driverTotal: number;
  categoryCounts: {
    category: string;
    high: number;
    medium: number;
    low: number;
  }[];
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
  riskExplanation: RiskExplanation;
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
