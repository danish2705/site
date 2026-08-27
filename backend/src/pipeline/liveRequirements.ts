import type { TrialRequirementRow } from "../types.js";
import {
  getCompletedTrialBenchmarks,
  getDropoutRateBenchmark,
  getEligibilityCriteriaSample,
} from "../services/ctgov.client.js";
import { estimateRequirementThresholds, llmStatus } from "../llm/client.js";

export interface BuildLiveTrialRequirementParams {
  indication: string;
  specialty: string;
  phase?: string;
  sampleSize?: number;
  durationMonths?: number;
  ageGroups?: string[];
}

export type LiveTrialRequirementRow = TrialRequirementRow & {
  requirementSource?: "live" | "llm-estimated" | "mixed";
  requirementWarning?: string;
};

const FALLBACK_SAMPLE_SIZE = 300;
const FALLBACK_DURATION_MONTHS = 18;
const FALLBACK_PHASE = "Phase III";

function toPositiveNumberOrUndefined(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function buildLiveTrialRequirement(
  params: BuildLiveTrialRequirementParams,
): Promise<LiveTrialRequirementRow> {
  const [benchmark, dropoutBenchmark, eligibilitySample] = await Promise.all([
    getCompletedTrialBenchmarks(params.indication),
    getDropoutRateBenchmark(params.indication),
    getEligibilityCriteriaSample(params.indication),
  ]);

  const targetSampleSize =
    toPositiveNumberOrUndefined(params.sampleSize) ??
    benchmark.medianSampleSize ??
    FALLBACK_SAMPLE_SIZE;
  const durationMonths =
    toPositiveNumberOrUndefined(params.durationMonths) ??
    benchmark.medianDurationMonths ??
    FALLBACK_DURATION_MONTHS;
  const phase = params.phase || FALLBACK_PHASE;

  const minEnrollmentRate =
    benchmark.medianEnrollmentRatePerMonth !== null
      ? Math.round(benchmark.medianEnrollmentRatePerMonth * 0.7 * 10) / 10
      : null;

  const maxAcceptableDropout =
    dropoutBenchmark.medianDropoutRatePercent !== null
      ? Math.round(dropoutBenchmark.medianDropoutRatePercent * 1.3 * 10) / 10
      : null;

  let minDataQualityScore: number | null = null;
  let maxAcceptableScreenFailurePercent: number | null = null;
  let requirementWarning: string | undefined;
  let thresholdSource: "llm-estimated" | "unavailable" = "unavailable";

  if (llmStatus().configured) {
    try {
      const estimate = await estimateRequirementThresholds({
        indication: params.indication,
        specialty: params.specialty,
        phase,
      });
      minDataQualityScore = estimate.fields.minDataQualityScore;
      maxAcceptableScreenFailurePercent =
        estimate.fields.maxAcceptableScreenFailurePercent;
      thresholdSource = "llm-estimated";
    } catch (err) {
      requirementWarning = `LLM requirement-threshold estimate failed (${(err as Error).message}) (AI-estimated fields unavailable) — Min Data Quality Score / Max Acceptable Screen Failure not applied.`;
    }
  } else {
    requirementWarning =
      "LLM not configured — no public source discloses protocol data-quality/screen-failure thresholds, so Min Data Quality Score / Max Acceptable Screen Failure are not applied.";
  }

  const requirementSource: LiveTrialRequirementRow["requirementSource"] =
    thresholdSource === "llm-estimated" ? "mixed" : "live";

  const ageGroup =
    params.ageGroups && params.ageGroups.length > 0
      ? params.ageGroups.join(", ")
      : "All ages (not specified)";

  return {
    "Trial ID": "LIVE-REQ", 
    Indication: params.indication,
    "Required Specialty": params.specialty,
    "Trial Type": "Live", 
    "Cohort / Subgroup Tag": "All-comers", 
    Phase: phase,
    "Age Group": ageGroup, 
    "Target Sample Size": targetSampleSize,
    "Duration (months)": durationMonths,
    "Budget Tier": "Mid", 
    "Min Enrollment Rate (pts/month)": minEnrollmentRate,
    "Max Acceptable Dropout (%)": maxAcceptableDropout,
    "Min Data Quality Score": minDataQualityScore,
    "Max Acceptable Screen Failure (%)": maxAcceptableScreenFailurePercent,
    "Accreditation Required": "Preferred", 
    "Required Infrastructure": "", 
    eligibilityCriteriaText: eligibilitySample?.eligibilityCriteriaText ?? null,
    eligibilitySex: eligibilitySample?.sex ?? null,
    eligibilityMinimumAge: eligibilitySample?.minimumAge ?? null,
    eligibilityMaximumAge: eligibilitySample?.maximumAge ?? null,
    eligibilityHealthyVolunteers: eligibilitySample?.healthyVolunteers ?? null,
    eligibilitySourceNctId: eligibilitySample?.sourceNctId ?? null,
    requirementSource,
    requirementWarning,
  };
}
