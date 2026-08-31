import type { ScoredSite, ExtendedEvaluationRow } from "./pipeline/scoring.js";
import type { SyntheticSiteCost } from "./data/syntheticSiteCost.js";
import type { SyntheticPatientRecord } from "./data/syntheticPatients.js";

export interface RegionRow {
  Region: string;
  Country: string;
  Indication: string;
  "Prevalence (per 100k)": number;
  "Regulatory Approval Time (weeks)": number;
  "Active Competing Trials": number;
  "Avg Cost per Patient (USD)": number;
  competingTrialsSource?: "live" | "excel";
  regionMetricsSource?: "live" | "llm-estimated" | "claims-synthetic" | "unavailable";
  metricsWarning?: string;
}

export interface LiveFacilityRow {
  nctId: string;
  briefTitle: string | null;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
  lastUpdatePostDate: string | null;
}

export interface LiveTrialBenchmark {
  sampleCount: number;
  phaseDistribution: Record<string, number>;
  medianSampleSize: number | null;
  medianDurationMonths: number | null;
  medianEnrollmentRatePerMonth: number | null;
}

export interface LiveTrialLandscapeResponse {
  indication: string;
  country: string | null;
  activeCompetingTrials: number | null;
  facilities: LiveFacilityRow[];
  competingStatuses: string[];
  benchmark: LiveTrialBenchmark;
  fetchedAt: string;
  warnings: string[];
}

export interface MapSiteRow {
  siteId: string;
  siteName: string;
  city: string | null;
  state: string | null;
  country: string;
  status: string | null;
  lat: number;
  lng: number;
  coordsSource: "live-google" | "live-nominatim" | "approximate";
  radiusMiles: number;
  populationInRadius: number;
  populationSource: "synthetic";
  prevalencePer100k: number;
  grossEligiblePatients: number;
  netAvailablePatients: number;
  recruitmentRateAssumed: number;
  riskScore: number | null;
  riskLevel: "Low" | "Medium" | "High" | "Unknown";
  riskRationale: string;
  riskSource: "llm-estimated" | "unavailable";
  patientSegments: PatientSegments | null;
  patientSegmentSource: "heuristic-illustrative";
  catchmentDistanceSource:
    | "live-google"
    | "live-osrm"
    | "approximate-haversine"
    | "mixed"
    | "none";
  recruitablePatients: number;
  assumedConsentRate: number;
  siteCost: SyntheticSiteCost;
  alreadyEnrolledPatients: number;
  patientSample: SyntheticPatientRecord[];
  ageEligibleFraction: number;
  ageGroupsApplied: string[];
}

export interface PatientSegments {
  newlyDiagnosed: number;
  nonResponder: number;
  stableOnTreatment: number;
}

export interface LiveMapResponse {
  indication: string;
  country: string | null;
  radiusMiles: number;
  sites: MapSiteRow[];
  warnings: string[];
  fetchedAt: string;
  ageGroupsRequested: string[];
  ageEligibilityDisclosure: string | null;
}

export interface CombinedCatchmentRequestSite {
  siteId: string;
  lat: number;
  lng: number;
}

export interface CombinedCatchmentResponse {
  indication: string;
  country: string;
  radiusMiles: number;
  siteCount: number;
  sumOfIndividualNetAvailablePatients: number;
  combinedNetAvailablePatients: number;
  overlapPatients: number;
  prevalencePer100k: number;
  warnings: string[];
}

export interface SiteCombinationRequestSite {
  siteId: string;
  siteName: string;
  city?: string | null;
  country?: string | null;
  recruitablePatients: number;
  riskScore: number | null;
  baseCostUsd?: number | null;
  perPatientCostUsd?: number | null;
}

export interface SiteCombinationSelectedSite {
  siteId: string;
  siteName: string;
  patientsTaken: number;
  recruitablePatientsAvailable: number;
  riskScore: number | null;
  estimatedCostUsd: number | null;
}

export interface SiteCombinationStrategyResult {
  strategy:
    | "lowest-risk-first"
    | "lowest-cost-first"
    | "balanced"
    | "highest-capacity-first";
  label: string;
  sites: SiteCombinationSelectedSite[];
  totalPatients: number;
  totalEstimatedCostUsd: number | null;
  averageRiskScore: number | null;
  portfolioRiskScore: number | null;
  meetsTarget: boolean;
}

export interface SiteCombinationResponse {
  targetEnrollment: number;
  avgCostPerPatientUsd: number | null;
  assumedConsentRate: number;
  strategies: SiteCombinationStrategyResult[];
  recommendedStrategy: SiteCombinationStrategyResult["strategy"] | null;
  method: string;
  warnings: string[];
}

export interface OutreachDraft {
  siteId: string;
  siteName: string;
  city: string | null;
  country: string | null;
  contactEmail: string;
  contactEmailSource: "synthetic";
  subject: string;
  body: string;
}

export interface OutreachDraftResponse {
  drafts: OutreachDraft[];
  warnings: string[];
}

export interface TrialRequirementRow {
  "Trial ID": string;
  Indication: string;
  "Required Specialty": string;
  "Trial Type": string;
  "Cohort / Subgroup Tag": string;
  Phase: string;
  "Age Group": string;
  "Target Sample Size": number;
  "Duration (months)": number;
  "Budget Tier": string;
  "Min Enrollment Rate (pts/month)": number | null;
  "Max Acceptable Dropout (%)": number | null;
  "Min Data Quality Score": number | null;
  "Max Acceptable Screen Failure (%)": number | null;
  "Accreditation Required": string;
  "Required Infrastructure": string;
  eligibilityCriteriaText?: string | null;
  eligibilitySex?: string | null;
  eligibilityMinimumAge?: string | null;
  eligibilityMaximumAge?: string | null;
  eligibilityHealthyVolunteers?: boolean | null;
  eligibilitySourceNctId?: string | null;
}

export interface RequirementCheck {
  criterion: string;
  required: string;
  actual: string;
  pass: boolean;
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
  dataSource?: "excel" | "live";
  recruitingStatus?: string | null;
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

export type RiskMatrix = Record<RiskLevel, Record<RiskLevel, RiskLevel>>;

export interface RiskDriver {
  riskId: string;
  category: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  rating: RiskLevel;
  status: string;
  active: boolean;
  derivation: string;
  standardReference?: string | null;
}

export interface RiskExplanation {
  level: RiskLevel;
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
  dataSource?: "excel" | "live" | "llm-estimated";
  "Standard Reference"?: string;
}

export interface RegionOptionRow {
  indication: string;
  region: string;
  country: string;
}

export interface Store {
  filePath: string;
  requirements: TrialRequirementRow[];
  requirementByIndication: Map<string, TrialRequirementRow>;
  regionData: RegionRow[];
  sites: SiteRow[];
  evaluations: ExtendedEvaluationRow[];
  risks: RiskRow[];
  riskMatrix: RiskMatrix;
  evalBySiteId: Map<string, ExtendedEvaluationRow>;
  risksBySiteId: Map<string, RiskRow[]>;
  indications: string[];
  regions: string[];
  regionOptions: RegionOptionRow[];
}

export interface RegionSelection {
  region: string;
  country: string;
}

export interface PipelineInput {
  indication: string;
  phase?: string;
  sampleSize?: number;
  durationMonths?: number;
  budgetTier?: string;
  regions?: RegionSelection[];
  ageGroups?: string[];
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
  confidence: RiskLevel;
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
  dataSource?: "excel" | "live" | "llm-estimated";
  standardReference?: string | null;
}

export interface RiskAssessmentRow {
  siteId: string;
  siteName: string;
  region: string;
  overallRisk: RiskLevel;
  highRiskCount: number;
  mediumRiskCount: number;
  riskRecords: RiskRecord[];
  status: string | null;
}

export type StageStatus = "in-progress" | "complete";

export interface StageEvent {
  stage: number;
  name: string;
  status: StageStatus;
  detail?: string;
  data?: unknown;
  llm?: string;
  warnings?: string[];
}

export type SendFn = (event: string, data: unknown) => void;

export interface RankedSite extends SiteRow {
  siteId: string;
  siteName: string;
  suitabilityScore: number | null;
  scored: ScoredSite;
  requirementChecks: RequirementCheck[];
  evalRow: ExtendedEvaluationRow;
  risks: RiskRow[];
  highRiskCount: number;
  mediumRiskCount: number;
  overallRisk: RiskLevel;
  riskExplanation: RiskExplanation;
  riskDataUnavailable: boolean;
}

export interface RecommendationResult {
  llm: string;
  text: string;
}

export interface SavedComponents {
  recruitment: number | null;
  quality: number | null;
  retention: number | null;
  diversity: number | null;
  cost: number | null;
}

export interface SavedSite {
  rank: number;
  siteId: string;
  siteName: string;
  region: string;
  score: number;
  components: SavedComponents;
  confidence: string;
  caveats: string[];
  meetsRequirements: boolean;
  failedCriteria: string[];
  suitabilityScore: number | null;
  riskLevel: RiskLevel;
  highRiskCount: number;
}

export interface SaveRunInput {
  label?: string;
  indication: string;
  phase?: string;
  sampleSize?: number;
  durationMonths?: number;
  budgetTier?: string;
  region?: string;
  country?: string;
  estimatedPatients?: number;
  llm?: string;
  final?: {
    recommendedSite?: string;
    siteId?: string;
    score?: number;
    confidence?: string;
    riskLevel?: RiskLevel;
    highRiskCount?: number;
    meetsRequirements?: boolean;
    text?: string;
    scoreExplanation?: string;
    requirementChecks?: unknown;
  } | null;
  ranking: SavedSite[];
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
