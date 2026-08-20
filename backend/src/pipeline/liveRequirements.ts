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
  /** Caller-provided eligible age group(s) (e.g. ["Adult (18-64)"]) — no live/LLM source, applied as given. */
  ageGroups?: string[];
}

export type LiveTrialRequirementRow = TrialRequirementRow & {
  requirementSource?: "live" | "llm-estimated" | "mixed";
  requirementWarning?: string;
};

// Last-resort defaults when neither a user override nor a live median is
// available at all (e.g. ClinicalTrials.gov has zero completed trials on
// file for this indication) — reasonable, generic phase-III-ish figures,
// not derived from any source.
const FALLBACK_SAMPLE_SIZE = 300;
const FALLBACK_DURATION_MONTHS = 18;
const FALLBACK_PHASE = "Phase III";

// A blank number input on the frontend (e.g. "Target Enrollment" left
// empty) arrives here as "" at runtime, even though the TS type says
// `number | undefined` — `params.sampleSize ?? fallback` would NOT catch
// that, because `??` only falls through on null/undefined, not on "". An
// empty string sailing through was landing in an integer DB column at save
// time ("invalid input syntax for type integer: ''"). This normalizes any
// non-positive-finite-number value (including "", NaN, 0, negative) to
// undefined so the `??` fallback chains below actually engage.
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

  // A site averaging ~70% of the real historical median enrollment rate is
  // still a workable, if below-average, site — 100% of the median would
  // reject roughly half of all historically-observed sites outright, which
  // is too strict for a "minimum acceptable" floor.
  const minEnrollmentRate =
    benchmark.medianEnrollmentRatePerMonth !== null
      ? Math.round(benchmark.medianEnrollmentRatePerMonth * 0.7 * 10) / 10
      : null;

  // Symmetric logic in the other direction: ~130% of the real historical
  // median dropout rate is a workable "maximum acceptable" ceiling — a site
  // right at the median shouldn't itself fail the check.
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
    "Trial ID": "LIVE-REQ", // no live/LLM source for a trial identifier — this app no longer tracks a specific protocol record, just live-derived thresholds
    Indication: params.indication,
    "Required Specialty": params.specialty,
    "Trial Type": "Live", // replaces the old Excel "Headline"/etc. taxonomy, which has no live equivalent
    "Cohort / Subgroup Tag": "All-comers", // no live/LLM source for subgroup tagging; "All-comers" is the least-assumption default
    Phase: phase,
    "Age Group": ageGroup, // no live/LLM source for eligible age group; caller-provided ageGroups (if any) applied as given
    "Target Sample Size": targetSampleSize,
    "Duration (months)": durationMonths,
    "Budget Tier": "Mid", // no live/LLM source for budget tier; caller-provided budgetTier (if any) is applied separately in runPipeline.ts
    "Min Enrollment Rate (pts/month)": minEnrollmentRate,
    "Max Acceptable Dropout (%)": maxAcceptableDropout,
    "Min Data Quality Score": minDataQualityScore,
    "Max Acceptable Screen Failure (%)": maxAcceptableScreenFailurePercent,
    "Accreditation Required": "Preferred", // no live/LLM source for accreditation policy; "Preferred" (not "Yes") avoids silently hard-failing every live site, which all show Accreditation: "Unknown"
    "Required Infrastructure": "", // no live/LLM source for infrastructure requirements
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
