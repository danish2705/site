export interface TrialForm {
  indication: string;
  phase: string;
  sampleSize: number | "";
  durationMonths: number | "";
  budgetTier: string;
  regions: string[];
}

export interface RegionOption {
  indication: string;
  region: string;
  country: string;
}

export interface LiveFieldValue {
  value: string;
  count: number;
}

export interface MetaResponse {
  indications: string[];
  /** "fallback" means the live ClinicalTrials.gov vocabulary lookup failed and `indications` is a static safety-net list, not live data. */
  indicationsSource?: "live" | "fallback";
  /** Set when indicationsSource is "fallback" — explains why and what's still live. */
  metaWarning?: string;
  regions: string[];
  regionOptions: RegionOption[];
  specialties: Record<string, string>;
  /** Live, ranked vocabulary from ClinicalTrials.gov (supplementary — may be empty on API outage). */
  liveConditions?: LiveFieldValue[];
  liveCountries?: LiveFieldValue[];
}

export interface RegionCandidate {
  region: string;
  country: string;
  prevalence: number;
  regulatoryWeeks: number;
  competingTrials: number;
  competingTrialsSource?: "live" | "excel";
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
  dataSource?: "excel" | "live" | "llm-estimated";
}

export interface RiskAssessmentRow {
  siteId: string;
  siteName: string;
  region: string;
  overallRisk: "Low" | "Medium" | "High";
  highRiskCount: number;
  mediumRiskCount: number;
  riskRecords: RiskRecord[];
}

export interface ComponentScores {
  recruitment: number | null;
  quality: number | null;
  retention: number | null;
  diversity: number | null;
  cost: number | null;
}

export interface RequirementCheck {
  criterion: string;
  required: string;
  actual: string;
  pass: boolean;
}

export interface RankingRow {
  rank: number;
  siteId: string;
  siteName: string;
  region: string;
  score: number;
  components: ComponentScores;
  confidence: "High" | "Medium" | "Low";
  caveats: string[];
  meetsRequirements: boolean;
  failedCriteria: string[];
  suitabilityScore: number | null;
  riskLevel: "Low" | "Medium" | "High";
  highRiskCount: number;
  /** "llm-estimated" = this site's KPIs came from an LLM estimate on a live ClinicalTrials.gov facility, not Site_Evaluation. */
  dataSource?: "excel" | "llm-estimated";
}

export interface FinalResult {
  region: string;
  country: string;
  estimatedPatients: number;
  recommendedSite: string;
  siteId: string;
  score: number;
  scoreExplanation: string;
  components: ComponentScores;
  confidence: "High" | "Medium" | "Low";
  meetsRequirements: boolean;
  requirementChecks: RequirementCheck[];
  suitabilityScore: number | null;
  riskLevel: "Low" | "Medium" | "High";
  highRiskCount: number;
  riskExplanation: RiskExplanation;
  dataSource?: "excel" | "llm-estimated";
  text: string;
}

export interface StageEventPayload {
  stage: number;
  name: string;
  status: StageStatus;
  detail?: string;
  data?: unknown;
  llm?: string;
  /** Explicit per-item issues (e.g. a live site that couldn't be scored) — sibling to `data`, not nested in it. */
  warnings?: string[];
}

export interface SavedRunSummary {
  id: string;
  created_at: string;
  label: string | null;
  indication: string;
  phase: string | null;
  region: string | null;
  country: string | null;
  recommended_site_name: string | null;
  score: number | null;
  confidence: string | null;
  risk_level: string | null;
  meets_requirements: boolean | null;
  ranked_site_count: number;
}

export interface SavedRunSite {
  rank: number;
  site_id: string;
  site_name: string | null;
  region: string | null;
  score: number | null;
  recruitment_score: number | null;
  quality_score: number | null;
  retention_score: number | null;
  diversity_score: number | null;
  cost_score: number | null;
  confidence: string | null;
  caveats: string[] | null;
  meets_requirements: boolean | null;
  failed_criteria: string[] | null;
  suitability_score: number | null;
  risk_level: "Low" | "Medium" | "High" | null;
  high_risk_count: number | null;
}

export interface SavedRunDetail {
  run: SavedRunSummary & {
    sample_size: number | null;
    duration_months: number | null;
    budget_tier: string | null;
    estimated_patients: number | null;
    recommendation_text: string | null;
    score_explanation: string | null;
    llm: string | null;
  };
  sites: SavedRunSite[];
}

export interface LiveFacilityRow {
  nctId: string;
  briefTitle: string | null;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
}

export interface LiveTrialBenchmark {
  sampleCount: number;
  phaseDistribution: Record<string, number>;
  medianSampleSize: number | null;
  medianDurationMonths: number | null;
}

export interface LiveTrialLandscapeResponse {
  indication: string;
  country: string | null;
  activeCompetingTrials: number | null;
  facilities: LiveFacilityRow[];
  benchmark: LiveTrialBenchmark;
  fetchedAt: string;
  warnings: string[];
}
