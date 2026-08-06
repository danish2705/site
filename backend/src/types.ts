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

// A single selectable (Indication, Region, Country) combination, derived
// from Region_Data, that the frontend offers in the Region / Country
// Selection input.
export interface RegionOptionRow {
  indication: string;
  region: string;
  country: string;
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
  regionOptions: RegionOptionRow[];
}

// A user-selected Region/Country pair, as submitted from the (multi-select)
// Region / Country Selection input.
export interface RegionSelection {
  region: string;
  country: string;
}

// What the frontend form submits to POST /api/run
export interface PipelineInput {
  indication: string;
  phase?: string;
  sampleSize?: number;
  durationMonths?: number;
  budgetTier?: string;
  // Optional user-picked region/country candidates (multi-select). When
  // provided, Stage 2 ranks and picks only among these instead of every
  // region on file for the indication.
  regions?: RegionSelection[];
}

// Camel-cased, JSON-friendly shape of a RiskRow, used whenever individual
// risk records are sent to the frontend (Stage 6/7/8 payloads).
export interface RiskRecord {
  riskId: string;
  siteId: string;
  category: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  overallRisk: RiskLevel;
  dateIdentified: string;
  status: string;
  mitigationPlan: string;
  owner: string;
  riskScore: number;
}

// Stage 6 ("AI Risk Assessment") output: one row per candidate site, each
// carrying its full set of individual risk records.
export interface RiskAssessmentRow {
  siteId: string;
  siteName: string;
  region: string;
  overallRisk: RiskLevel;
  highRiskCount: number;
  mediumRiskCount: number;
  riskRecords: RiskRecord[];
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
