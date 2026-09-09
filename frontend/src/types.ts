export interface TrialForm {
  indication: string;
  phase: string;
  sampleSize: number | "";
  durationMonths: number | "";
  budgetTier: string;
  regions: string[];
  /** Eligible patient age group(s) for this trial (e.g. "Adult (18-64)"). Optional — empty means all ages. */
  ageGroups: string[];
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
  standardReference?: string | null;
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
  standardReference?: string | null;
}

export interface RiskAssessmentRow {
  siteId: string;
  siteName: string;
  region: string;
  overallRisk: "Low" | "Medium" | "High";
  highRiskCount: number;
  mediumRiskCount: number;
  /** True when this site has no real or estimated risk data at all — show "No Data" instead of trusting overallRisk's "Low". */
  riskDataUnavailable: boolean;
  riskRecords: RiskRecord[];
  /** Real, raw ClinicalTrials.gov status for this site (e.g. "RECRUITING", "NOT_YET_RECRUITING", "COMPLETED"...) — null if the source facility had no disclosed status. Every real status is included (no server-side filtering); use the Status filter dropdown to narrow the view. */
  status: string | null;
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
  /** Whether the "Required" value came from real, disclosed data (e.g. a ClinicalTrials.gov benchmark) rather than user form input, an invented label, or a self-referential run average. */
  requiredIsLive?: boolean;
  /** Whether the "This site" (actual) value is real, disclosed data (ClinicalTrials.gov, etc.) rather than an LLM estimate. */
  actualIsLive?: boolean;
}

export interface EnrollmentForecast {
  targetSampleSize: number;
  durationMonths: number;
  /** pts/month used for this projection. */
  rate: number;
  /** Whether `rate` is real (this facility's own ClinicalTrials.gov enrollment history) or an LLM estimate. */
  rateSource: "real" | "llm-estimated";
  /** Projected cumulative enrollment at this site over the full trial duration, at `rate`. */
  expectedEnrollment: number;
  /** How many months this site alone would need, at `rate`, to reach targetSampleSize. */
  estimatedMonthsToTarget: number;
  /** 0-100, or null when this site doesn't have enough of its own real completed-trial history to bootstrap a genuine estimate — see probabilityBasis. Never borrowed from indication-wide data. */
  probability: number | null;
  probabilityBasis: "site-history" | "insufficient-data";
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
  /** Full per-criterion requirement checklist for this site (required specialty, patient age, required procedure, minimum recruitment, competing trials nearby) — see backend's runPipeline.ts checkRequirements(). */
  requirementChecks: RequirementCheck[];
  /** Real-arithmetic enrollment projection + (when supported by this site's own real historical data) a bootstrap probability of hitting the trial's target — see backend's pipeline/enrollmentForecast.ts. null when no rate/target/duration was available to project from at all. */
  enrollmentForecast: EnrollmentForecast | null;
  suitabilityScore: number | null;
  riskLevel: "Low" | "Medium" | "High";
  highRiskCount: number;
  /** "llm-estimated" = this site's KPIs came from an LLM estimate on a live ClinicalTrials.gov facility, not Site_Evaluation. */
  dataSource?: "excel" | "llm-estimated";
  /** Raw KPI field names (e.g. "Historical Enrollment Rate (pts/month)") overridden with real ClinicalTrials.gov data instead of the LLM estimate. Empty when every field is still estimated. */
  liveKpiFields?: string[];
  /** The NCTId Dropout Rate/Diversity Index (if real) were sourced from — trial-wide, not this site alone. null when neither is real. */
  liveKpiSourceNctId?: string | null;
  /** Real race/ethnicity category breakdown behind the Diversity component, when it's real (not LLM-estimated) — e.g. [{category:"White",percent:61.2},...]. null otherwise. */
  raceBreakdown?: { category: string; percent: number }[] | null;
  /** Real, raw ClinicalTrials.gov status for this site (e.g. "RECRUITING", "NOT_YET_RECRUITING", "COMPLETED"...) — null if the source facility had no disclosed status. Every real status is included (no server-side filtering); use the Status filter dropdown to narrow the view. */
  status: string | null;
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
  liveKpiFields?: string[];
  text: string;
  /** Real, live ClinicalTrials.gov status of the recommended site (e.g. "RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING") — null if unknown. Used by the status dropdown on the Final Recommendation page to know which slot this result belongs to. */
  status?: string | null;
  /** Id of the cached, fully-scored candidate pool this result came from — pass back to fetchRecommendationForStatus() to get the best site for a different live status without re-running Stages 4-6. Absent for older/edge-case results. */
  analysisId?: string;
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
  /** When the sponsor last updated this trial's record on ClinicalTrials.gov. */
  lastUpdatePostDate: string | null;
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
  competingStatuses: string[];
  benchmark: LiveTrialBenchmark;
  fetchedAt: string;
  warnings: string[];
}

export interface NctLookupResponse {
  nctId: string;
  briefTitle: string | null;
  officialTitle: string | null;
  indication: string | null;
  overallStatus: string | null;
  phase: string | null;
  ageGroups: string[];
  enrollmentCount: number | null;
  enrollmentType: string | null;
  durationMonths: number | null;
  countries: string[];
  siteCount: number;
  facilities: LiveFacilityRow[];
}

export interface RareDiseaseSearchResult {
  orphaCode: string;
  name: string;
}

export interface RareDiseasePrevalenceRow {
  type: string | null;
  qualification: string | null;
  prevalenceClass: string | null;
  value: string | null;
  geographicArea: string | null;
  validationStatus: string | null;
  source: string | null;
}

export interface RareDiseaseCrossReference {
  source: string;
  reference: string;
}

export interface RareDiseaseTrialSite {
  nctId: string;
  briefTitle: string | null;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: string | null;
}

export interface RareDiseaseDetail {
  orphaCode: string;
  name: string;
  definition: string | null;
  typology: string | null;
  synonyms: string[];
  crossReferences: RareDiseaseCrossReference[];
  inheritance: string[];
  averageAgeOfOnset: string[];
  averageAgeOfDeath: string[];
  prevalence: RareDiseasePrevalenceRow[];
  trialSites: RareDiseaseTrialSite[];
  warnings: string[];
  sources: {
    nomenclature: string;
    epidemiology: string;
    naturalHistory: string;
    trials: string;
  };
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
  populationSource: "synthetic" | "worldpop-live";
  populationCitation?: string;
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

export interface SyntheticSiteCost {
  baseCostUsd: number;
  perPatientCostUsd: number;
  costSource: "synthetic";
}

export interface SyntheticPatientRecord {
  patientId: string;
  disease: string;
  age: number;
  kidneyDisease: boolean;
  liverDisease: boolean;
  heartDisease: boolean;
  diabetes: boolean;
  trialStatus: "Available" | "Enrolled";
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

export interface EligibilityFilterOption {
  id: string;
  label: string;
  detail: string;
  type: "inclusion" | "exclusion";
  estimatedExcludedPercent: number;
}

export interface EligibilityFilterSetResponse {
  indication: string;
  sourceNctId: string | null;
  criteriaText: string | null;
  sex: string | null;
  minimumAge: string | null;
  maximumAge: string | null;
  healthyVolunteers: boolean | null;
  filters: EligibilityFilterOption[];
  filtersSource: "llm-estimated" | "unavailable";
  warning?: string;
}
