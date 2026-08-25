import type { RegionPredictionResponse, TrialForm } from "../types";
import { postJson } from "./api";

export type RegionPredictionInput = Pick<
  TrialForm,
  "indication" | "phase" | "sampleSize" | "durationMonths" | "budgetTier"
>;

export function predictRegion(
  input: RegionPredictionInput,
  signal?: AbortSignal,
): Promise<RegionPredictionResponse> {
  return postJson<RegionPredictionResponse>(
    "/api/predict-region",
    input,
    undefined,
    signal,
  );
}
