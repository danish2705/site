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
  /** Set by services/liveRegionData.ts once a row has been enriched. */
  competingTrialsSource?: "live" | "excel";
  /** Source of Prevalence/Regulatory/Cost fields on this row — see pipeline/liveRegionMetrics.ts. */
  regionMetricsSource?: "live" | "llm-estimated" | "unavailable";
  /** Set when regionMetricsSource is "unavailable" (LLM not configured or the call failed), explaining why those fields are 0 rather than a real/estimated figure. */
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
  /** When the sponsor last updated this trial's record on ClinicalTrials.gov (protocolSection.statusModule.lastUpdatePostDateStruct.date). */
  lastUpdatePostDate: string | null;
  /** Real, disclosed eligibility age bounds of the study this facility belongs to — see services/ctgov.client.ts's LiveFacility. */
  minimumAge?: string | null;
  maximumAge?: string | null;
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
  /** Which OverallStatus values are currently configured to count toward activeCompetingTrials — see config.ts's competingTrials.statuses. Sent so the UI can badge each facility row as counted/not-counted without duplicating this business rule on the frontend. */
  competingStatuses: string[];
  benchmark: LiveTrialBenchmark;
  fetchedAt: string;
  warnings: string[];
}

/**
 * Normalized response for GET /api/nct-lookup/:nctId — the landing page's
 * "Search by NCT Number" auto-fill. Maps ClinicalTrials.gov's own vocabulary
 * (raw Phase values, StdAge buckets) onto this app's own form field values
 * (Sidebar's PHASES/AGE_GROUPS labels) so the frontend can drop these straight
 * into TrialForm with no further translation.
 */
export interface NctLookupResponse {
  nctId: string;
  briefTitle: string | null;
  officialTitle: string | null;
  /** Raw disclosed condition text — dropped straight into TrialForm.indication even when it doesn't exactly match this app's static indication list (resolveSpecialty() already falls back to an LLM for indications outside that list, so no manual reconciliation is needed here). */
  indication: string | null;
  overallStatus: string | null;
  /** Mapped to this app's "Phase I".."Phase IV" labels — null if the study's disclosed phase(s) don't map to exactly one of those (e.g. no phase disclosed, or an ambiguous multi-phase study), in which case the frontend leaves Phase unset for the user/pipeline default to handle. */
  phase: string | null;
  /** This app's Age Group label(s) (Sidebar's AGE_GROUPS) the study's disclosed eligibility age range overlaps — same bucketing ctgov.client.ts already applies when filtering live facilities by age. */
  ageGroups: string[];
  enrollmentCount: number | null;
  /** "ACTUAL" (post-completion, reliable) or "ESTIMATED" (a target). */
  enrollmentType: string | null;
  /** start -> primary-completion, in whole months — null if either date is missing/unparseable. */
  durationMonths: number | null;
  /** De-duplicated disclosed site countries — informational context only; NOT applied as a region/country filter (see NctStudyLookup.countries in ctgov.client.ts for why). */
  countries: string[];
  siteCount: number;
}

/** One trial site plotted on the Site Map tab — see pipeline/liveMapData.ts for exactly what's live vs. synthetic vs. approximate in each field. */
export interface MapSiteRow {
  siteId: string;
  siteName: string;
  city: string | null;
  state: string | null;
  country: string;
  status: string | null;
  lat: number;
  lng: number;
  /** "live-google" if GOOGLE_MAPS_API_KEY is configured and Google's geocode call succeeded; "live-nominatim" if the free OpenStreetMap Nominatim lookup succeeded instead; "approximate" only if both live tiers were unavailable (deterministic placement near the country/city, not precisely geocoded) — see services/geo.service.ts. */
  coordsSource: "live-google" | "live-nominatim" | "approximate";
  radiusMiles: number;
  /** Sum of synthetic catchment population within radiusMiles of this site — see data/syntheticPopulation.ts for why this is synthetic, not real, data. */
  populationInRadius: number;
  populationSource: "synthetic";
  /** LLM-estimated prevalence per 100k for this indication/country — see liveRegionMetrics.ts (no live source exists at this granularity). */
  prevalencePer100k: number;
  grossEligiblePatients: number;
  netAvailablePatients: number;
  /** Fraction of gross-eligible patients assumed already enrolled elsewhere — derived from the real completed-trial benchmark median sample size when available, else a fixed baseline (config.map.baselineRecruitmentRate). */
  recruitmentRateAssumed: number;
  riskScore: number | null;
  riskLevel: "Low" | "Medium" | "High" | "Unknown";
  riskRationale: string;
  riskSource: "llm-estimated" | "unavailable";
  /**
   * Illustrative split of `netAvailablePatients` into treatment-stage
   * buckets — see config.map.patientSegmentSplit. NOT derived from real
   * claims/EHR data (no live source distinguishes these groups per site at
   * this granularity); null only if netAvailablePatients is 0.
   */
  patientSegments: PatientSegments | null;
  patientSegmentSource: "heuristic-illustrative";
  /**
   * Which distance tier actually decided this site's catchment radius (see
   * services/geo.service.ts's getDistancesMilesBatch): "live-google"/
   * "live-osrm" if every catchment point counted was checked with a real
   * driving-distance lookup, "approximate-haversine" if every one fell back
   * to straight-line distance, "mixed" if some of each, "none" if the site
   * had zero candidate points to check in the first place. Distinct from
   * `coordsSource`, which is about the site's own pin location, not the
   * distance used to decide what's inside its radius.
   */
  catchmentDistanceSource:
    | "live-google"
    | "live-osrm"
    | "approximate-haversine"
    | "mixed"
    | "none";
  /**
   * netAvailablePatients further reduced by this site's own assumedConsentRate
   * — a second, distinct haircut from recruitmentRateAssumed above.
   * netAvailablePatients already estimates "how many eligible patients
   * aren't already absorbed by other trials"; this answers a different
   * question — "of those, how many will actually consent to enroll in THIS
   * trial once approached" — which no live or LLM source discloses. This is
   * the number the Site Combination Planner accumulates toward a target
   * enrollment, not netAvailablePatients directly (100 eligible ≠ 100
   * enrolled).
   */
  recruitablePatients: number;
  /**
   * Per-site SYNTHETIC consent/conversion rate (see
   * data/syntheticSiteCost.ts's syntheticConsentRateFor) — a deterministic
   * variation around config.siteCombination.assumedConsentRate, the app's
   * configured center value. Not one flat rate applied identically to every
   * site: no live or LLM source discloses a real per-site
   * screening-to-enrollment conversion rate, so rather than showing an
   * obviously-uniform percentage on every row, this fabricates a
   * plausible, stable-per-site spread around the configured center.
   */
  assumedConsentRate: number;
  /** Deterministic SYNTHETIC per-site cost figure — see data/syntheticSiteCost.ts for why no live/LLM source exists for this. */
  siteCost: SyntheticSiteCost;
  alreadyEnrolledPatients: number;
  /**
   * Requirement #4 ("Update Synthetic Patient Data"): a small (25-row),
   * deterministic, illustrative SAMPLE of individual synthetic patient
   * records for this site — Patient ID, disease, age, named comorbidity
   * flags, and a fabricated Trial Status ("Available" | "Enrolled"). See
   * data/syntheticPatients.ts for why this is a sample rather than one row
   * per real eligible patient, and why every value here is fabricated, not
   * derived from any real EHR/claims/CTMS source.
   */
  patientSample: SyntheticPatientRecord[];
  /**
   * 0-1 multiplier actually applied to this site's grossEligiblePatients to
   * reflect the trial form's selected Age Group(s) — see
   * data/ageDemographics.ts's getAgeEligibleFraction. 1 when no Age Group
   * was selected (all ages included, no narrowing).
   */
  ageEligibleFraction: number;
  /** Which Age Group label(s) were actually applied to this site's numbers — empty when none were selected. */
  ageGroupsApplied: string[];
}

/** See MapSiteRow.patientSegments. */
export interface PatientSegments {
  /** Treatment-naive patients recently diagnosed — the strongest recruits. */
  newlyDiagnosed: number;
  /** On an existing treatment with an inadequate response — realistic switch/add-on candidates. */
  nonResponder: number;
  /** Stable/responding on their current treatment — unlikely to enroll. */
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
  /** What the per-site age-eligibility adjustment is and isn't — see data/ageDemographics.ts. null when ageGroupsRequested is empty (nothing to disclose). */
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
  /** Sum of every selected site's own netAvailablePatients — what you'd get (incorrectly) by adding each site's number together. */
  sumOfIndividualNetAvailablePatients: number;
  /** The de-duplicated figure — each synthetic catchment point counted once even if multiple selected sites' radii cover it. */
  combinedNetAvailablePatients: number;
  /** How many patients the naive sum double-counted (sumOfIndividual - combined), i.e. the overlap between the selected sites' catchments. */
  overlapPatients: number;
  prevalencePer100k: number;
  warnings: string[];
}

export interface SiteCombinationRequestSite {
  siteId: string;
  siteName: string;
  city?: string | null;
  country?: string | null;
  /**
   * How many patients this site could realistically contribute toward the
   * target — already netted for competing/already-enrolled patients AND for
   * the assumed consent rate (MapSiteRow.recruitablePatients on the Site Map
   * response). Older callers passing the pre-consent-rate
   * `netAvailablePatients` figure still work (see the controller's fallback),
   * but will overstate what a site can realistically deliver.
   */
  recruitablePatients: number;
  riskScore: number | null;
  /** Per-site SYNTHETIC cost (see data/syntheticSiteCost.ts) — optional; when omitted the optimizer falls back to the single region-wide avgCostPerPatientUsd for that site. */
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
  /** The app's CONFIGURED CENTER consent-rate assumption (config.siteCombination.assumedConsentRate) — each site's own recruitablePatients actually used a per-site SYNTHETIC rate varying around this center (see MapSiteRow.assumedConsentRate / data/syntheticSiteCost.ts's syntheticConsentRateFor), not this single flat number applied identically to every site. Shown here as the reference center value, not the literal per-site rate. */
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
  /** SYNTHETIC placeholder address — ClinicalTrials.gov only sometimes discloses a central sponsor contact and never a reliable per-facility email; this is fabricated, not a real address, and this app never actually sends anything to it. */
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
  /**
   * Real, disclosed eligibilityModule fields from one representative trial
   * for this indication (see getEligibilityCriteriaSample in
   * ctgov.client.ts) — informational only. NOT applied as a filter on the
   * synthetic eligible-patient counts shown elsewhere (Site Map, region
   * prevalence): that dataset has no per-patient comorbidity/condition
   * attributes to filter against, so pretending to apply these criteria to
   * it would fabricate a number. All fields null/undefined if no trial for
   * this indication discloses eligibility data.
   */
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

export interface EnrollmentForecast {
  targetSampleSize: number;
  durationMonths: number;
  /** pts/month used for this projection. */
  rate: number;
  /** Whether `rate` came from this facility's own real ClinicalTrials.gov enrollment history, or an LLM estimate. */
  rateSource: "real" | "llm-estimated";
  /** Projected cumulative enrollment at this site over the full trial duration, at `rate` — real arithmetic (rate * durationMonths), no more/less certain than `rate` itself. */
  expectedEnrollment: number;
  /** How many months this site alone would need, at `rate`, to reach targetSampleSize. */
  estimatedMonthsToTarget: number;
  /**
   * 0-100 probability of this site reaching targetSampleSize within
   * durationMonths, from bootstrap-resampling this site's OWN real
   * historical per-trial enrollment rates (see
   * pipeline/enrollmentForecast.ts) — never borrowed from a broader,
   * less-specific distribution. null when probabilityBasis is
   * "insufficient-data".
   */
  probability: number | null;
  probabilityBasis: "site-history" | "insufficient-data";
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
  /** "live" = real facility pulled from ClinicalTrials.gov this run; absent/"excel" = from Candidate_Sites. */
  dataSource?: "excel" | "live";
  /** Real, live OverallStatus for this facility's trial from ClinicalTrials.gov (e.g. "RECRUITING", "NOT_YET_RECRUITING", "COMPLETED"...). null/absent for a non-live site or if the source facility had no status. Used to restrict Risk Register/Ranking to only actively-or-soon recruiting sites and to label the Status column shown on those pages. */
  recruitingStatus?: string | null;
  /**
   * Real, disclosed eligibilityModule.minimumAge/maximumAge of the SPECIFIC
   * trial this candidate site was sourced from (see
   * services/ctgov.client.ts's LiveFacility) — used to build a genuine
   * per-site "Patient age" requirement check. Age eligibility is a
   * protocol-wide setting, not something ClinicalTrials.gov tracks per
   * physical location, but different candidate sites here usually come from
   * different trials, so this genuinely varies site to site in practice.
   */
  eligibilityMinimumAge?: string | null;
  eligibilityMaximumAge?: string | null;
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
  /** "live" = real, disclosed ClinicalTrials.gov trial-status fact; "llm-estimated" = AI-estimated for a category with no public source; absent/"excel" = from Risk_Register. */
  dataSource?: "excel" | "live" | "llm-estimated";
  /** Which regulatory/registration standard the category's underlying field(s) come from (e.g. "FDAAA 801", "42 CFR Part 11") — for UI attribution only, not a compliance claim. Absent for the no-data placeholder row. */
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
  /** Eligible patient age group(s) for this trial (e.g. "Adult (18-64)"). Optional — empty/absent means all ages. */
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
  /** Which regulatory/registration standard the category's underlying field(s) come from (e.g. "FDAAA 801", "42 CFR Part 11") — for UI attribution only, not a compliance claim. Null for the no-data placeholder row. */
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
  /** Real, raw ClinicalTrials.gov status for this site (e.g. "RECRUITING", "NOT_YET_RECRUITING", "COMPLETED"...) — null if the source facility had no disclosed status. Every real status is included here (not filtered server-side); the UI derives its own display label/color and status filter from this. Not to be confused with RiskRow.Status, which is a risk-mitigation workflow status (e.g. "Open"). */
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
  /** Explicit per-item issues (e.g. a live site that couldn't be scored) — sibling to `data`, not nested in it. */
  warnings?: string[];
}

export type SendFn = (event: string, data: unknown) => void;

export interface RankedSite extends SiteRow {
  siteId: string;
  siteName: string;
  suitabilityScore: number | null;
  scored: ScoredSite;
  requirementChecks: RequirementCheck[];
  enrollmentForecast: EnrollmentForecast | null;
  evalRow: ExtendedEvaluationRow;
  risks: RiskRow[];
  highRiskCount: number;
  mediumRiskCount: number;
  overallRisk: RiskLevel;
  riskExplanation: RiskExplanation;
  /** True when `risks` is just the single "no data available" placeholder — lets the UI show "No Data" instead of a misleadingly clean "Low Risk" badge. */
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
