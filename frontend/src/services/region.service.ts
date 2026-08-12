import type { RegionPredictionResponse, TrialForm } from "../types";
import { postJson } from "./api";

export type RegionPredictionInput = Pick<
  TrialForm,
  "indication" | "phase" | "sampleSize" | "durationMonths" | "budgetTier"
>;

/** Standalone AI region suggestion — independent of the 8-stage pipeline. */
export function predictRegion(
  input: RegionPredictionInput,
): Promise<RegionPredictionResponse> {
  return postJson<RegionPredictionResponse>("/api/predict-region", input);
}
