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

// The Risk_Matrix sheet as a lookup: riskMatrix[Likelihood][Impact] = rating.
export type RiskMatrix = Record<RiskLevel, Record<RiskLevel, RiskLevel>>;

// A single risk record that drove a site's overall rating, with the matrix
// derivation spelled out so the UI can show why THIS record is rated as it is.
export interface RiskDriver {
  riskId: string;
  category: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  rating: RiskLevel;
  status: string;
  // Whether the record is still live (Open / Monitoring) as opposed to
  // resolved (Mitigated / Closed) — an unresolved High reads very
  // differently from one that's already been closed out.
  active: boolean;
  // e.g. "Likelihood Medium x Impact High -> High (per the risk matrix)"
  derivation: string;
}

// Explains WHY a site carries its Low/Medium/High rating, rather than just
// asserting the level. Attached to the Stage 8 recommended site only — the
// Stage 6 accordion deliberately shows the raw register instead, since the
// per-record Likelihood/Impact/Overall columns are already right there.
export interface RiskExplanation {
  level: RiskLevel;
  // The rule that fired, in plain language.
  rule: string;
  // One-line plain-language summary suitable for a callout.
  summary: string;
  totalRecords: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  // Live (Open / Monitoring) records at the site's own rating level.
  activeAtLevel: number;
  // The records responsible for the level, worst-and-still-open first.
  drivers: RiskDriver[];
  // How many records sit at the deciding level in total, so the UI can say
  // "showing 3 of 7" when drivers is capped.
  driverTotal: number;
  // Per-category breakdown, so a site whose risk is concentrated in one
  // area (e.g. all Enrollment) is distinguishable from one spread thin.
  categoryCounts: {
    category: string;
    high: number;
    medium: number;
    low: number;
  }[];
}

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
  riskMatrix: RiskMatrix;
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

// ---- AI Region Prediction (POST /api/predict-region) ----
// One scored region option, joining a Region_Data row against the sites /
// evaluations / risk records that exist for the indication's specialty.
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
  // null when the region has no usable historical enrollment rate, i.e. a
  // time-to-enroll can't be estimated at all (rendered as "—").
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
  confidence: RiskLevel; // reuses Low | Medium | High
  // Why the confidence is what it is — a High/Medium/Low badge with no
  // justification is just a vibe, so this states what drove the level
  // (e.g. how far clear the winner is of the runner-up).
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
  // How many regions on file for this indication were skipped because they
  // have no candidate sites in the required specialty.
  excludedNoSites: number;
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
  riskExplanation: RiskExplanation;
}

export interface RecommendationResult {
  llm: string;
  text: string;
}
