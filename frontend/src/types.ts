export interface TrialForm {
  indication: string;
  phase: string;
  sampleSize: number;
  durationMonths: number;
  budgetTier: string;
}

export interface MetaResponse {
  indications: string[];
  regions: string[];
  specialties: Record<string, string>;
}

export type StageStatus = "pending" | "in-progress" | "complete";

export interface StageState {
  status: StageStatus;
  detail: string | null;
  data: unknown;
}

export type StagesMap = Record<number, StageState>;

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
