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
  /** Which OverallStatus values currently count toward activeCompetingTrials — see backend config.ts's competingTrials.statuses. Use this to badge each facility row as counted/not-counted rather than hardcoding the list here. */
  competingStatuses: string[];
  benchmark: LiveTrialBenchmark;
  fetchedAt: string;
  warnings: string[];
}

/** One trial site plotted on the Site Map tab — see the backend's pipeline/liveMapData.ts for exactly what's live vs. synthetic vs. approximate in each field. */
export interface MapSiteRow {
  siteId: string;
  siteName: string;
  city: string | null;
  state: string | null;
  country: string;
  status: string | null;
  lat: number;
  lng: number;
  /** "live-google" if the backend has GOOGLE_MAPS_API_KEY configured and Google's geocode call succeeded; "live-nominatim" if the free OpenStreetMap lookup succeeded instead; "approximate" only if both live tiers were unavailable (not precisely geocoded). */
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
  /** Illustrative split of netAvailablePatients into treatment-stage buckets — NOT real claims data, see backend config.map.patientSegmentSplit. Null only if netAvailablePatients is 0. */
  patientSegments: PatientSegments | null;
  patientSegmentSource: "heuristic-illustrative";
  /** Which distance tier decided this site's catchment radius — "live-google"/"live-osrm" mean real driving distance was used for every point counted, "approximate-haversine" means straight-line distance was used throughout, "mixed" means some of each, "none" means there were no candidate points to check. */
  catchmentDistanceSource:
    | "live-google"
    | "live-osrm"
    | "approximate-haversine"
    | "mixed"
    | "none";
  /**
   * netAvailablePatients further reduced by this site's own assumedConsentRate
   * below — a second, distinct haircut from recruitmentRateAssumed above.
   * This is the number the Site Combination Planner accumulates toward a
   * target enrollment, not netAvailablePatients directly (100 eligible ≠
   * 100 enrolled).
   */
  recruitablePatients: number;
  /** Per-site SYNTHETIC consent/conversion rate — a deterministic variation around the app's configured center (backend config.siteCombination.assumedConsentRate), not one flat rate applied identically to every site. See backend data/syntheticSiteCost.ts's syntheticConsentRateFor. */
  assumedConsentRate: number;
  /** Deterministic SYNTHETIC per-site cost figure — see backend data/syntheticSiteCost.ts for why no live/LLM source exists for this. */
  siteCost: SyntheticSiteCost;
  /**
   * grossEligiblePatients minus netAvailablePatients — the "already enrolled
   * in another trial for this indication" figure from requirement #1, made
   * explicit as its own number (it was always folded silently into
   * netAvailablePatients before). Always reconciles exactly:
   * grossEligiblePatients = alreadyEnrolledPatients + netAvailablePatients.
   */
  alreadyEnrolledPatients: number;
  /**
   * Requirement #4: a small (25-row), deterministic, illustrative SAMPLE of
   * individual synthetic patient records for this site — every value
   * fabricated, standing in for real per-patient EHR/claims/CTMS data that
   * has no live public source. See backend data/syntheticPatients.ts.
   */
  patientSample: SyntheticPatientRecord[];
  /** 0-1 multiplier actually applied to this site's grossEligiblePatients for the selected Age Group(s). 1 = no narrowing (all ages). */
  ageEligibleFraction: number;
  /** Which Age Group label(s) were actually applied to this site's numbers — empty when none were selected. */
  ageGroupsApplied: string[];
}

/** See MapSiteRow.siteCost. */
export interface SyntheticSiteCost {
  baseCostUsd: number;
  perPatientCostUsd: number;
  costSource: "synthetic";
}

/** See MapSiteRow.patientSample. */
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
  /** null = global search across every country ClinicalTrials.gov returned. */
  country: string | null;
  radiusMiles: number;
  sites: MapSiteRow[];
  warnings: string[];
  fetchedAt: string;
  /** The Age Group label(s) the trial form had selected for this request — empty means "all ages" (no narrowing applied). */
  ageGroupsRequested: string[];
  /** What the per-site age-eligibility adjustment is and isn't. null when ageGroupsRequested is empty. */
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
  /** How many of this site's recruitable patients this strategy actually uses — may be less than recruitablePatientsAvailable when only a partial allocation is needed to reach the target. */
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
  /** Sum, across every selected site, of (patientsTaken * riskScore / 100) — an expected count of at-risk patient-equivalents for this whole combination, not just a plain average of each site's score. Null if any selected site has no riskScore. */
  portfolioRiskScore: number | null;
  meetsTarget: boolean;
}

export interface SiteCombinationResponse {
  targetEnrollment: number;
  avgCostPerPatientUsd: number | null;
  /** The app's configured CENTER consent-rate assumption — each site's own recruitablePatients actually used a per-site synthetic rate varying around this center (see MapSiteRow.assumedConsentRate), not this single flat number applied identically everywhere. */
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
  /** SYNTHETIC placeholder address — fabricated, not a real contact, and never actually sent to. */
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
  /** Short checkbox phrase, kept <=45 characters server-side so it never needs truncating in the UI. */
  label: string;
  /** Fuller clinical wording behind the short label — show this in a tooltip/title, not on the checkbox itself. Equal to `label` when there's nothing more to add. */
  detail: string;
  type: "inclusion" | "exclusion";
  /** LLM-estimated % of the general indication population this single criterion alone would exclude — not cumulative with other filters, not a measured fact. */
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
