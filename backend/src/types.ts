export interface RegionRow {
  Region: string;
  Country: string;
  Indication: string;
  "Prevalence (per 100k)": number;
  "Regulatory Approval Time (weeks)": number;
  "Active Competing Trials": number;
  "Avg Cost per Patient (USD)": number;
}

export interface SiteRow {
  "Site ID": string;
  "Site Name": string;
  Region: string;
  Country: string;
  City: string;
  "Therapeutic Area": string;
  "Hospital Type": string;
  Accreditation: string;
}

export interface EvaluationRow {
  "Site ID": string;
  "Investigator Experience Score (0-10)": number;
  "Years Experience": number;
  "Prior Trials Count": number;
  "Historical Enrollment Rate (pts/month)": number;
  "Dropout Rate (%)": number;
  "Staff Availability Score (0-10)": number;
  "Infrastructure Readiness (%)": number;
  "Data Quality Score (0-100)": number;
  "Competing Trials at Site": number;
  "Suitability Score (0-100)": number | null;
}

export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskRow {
  "Risk ID": string;
  "Site ID": string;
  "Risk Category": string;
  Description: string;
  Likelihood: RiskLevel;
  Impact: RiskLevel;
  "Overall Risk Rating": RiskLevel;
  "Date Identified": string | Date;
  Status: string;
  "Mitigation Plan": string;
  Owner: string;
  "Risk Score (Numeric)": number;
}

export interface Store {
  filePath: string;
  regionData: RegionRow[];
  sites: SiteRow[];
  evaluations: EvaluationRow[];
  risks: RiskRow[];
  evalBySiteId: Map<string, EvaluationRow>;
  risksBySiteId: Map<string, RiskRow[]>;
  indications: string[];
  regions: string[];
}

// What the frontend form submits to POST /api/run
export interface PipelineInput {
  indication: string;
  phase?: string;
  sampleSize?: number;
  durationMonths?: number;
  budgetTier?: string;
}

export type StageStatus = "in-progress" | "complete";

export interface StageEvent {
  stage: number;
  name: string;
  status: StageStatus;
  detail?: string;
  data?: unknown;
  llm?: string;
}

// The callback pipeline.ts uses to push progress to the SSE stream
export type SendFn = (event: string, data: unknown) => void;

export interface RankedSite extends SiteRow {
  siteId: string;
  siteName: string;
  suitabilityScore: number | null;
  evalRow: EvaluationRow;
  risks: RiskRow[];
  highRiskCount: number;
  mediumRiskCount: number;
  overallRisk: RiskLevel;
}

export interface RecommendationResult {
  llm: string;
  text: string;
}
