import type { FinalResult, LiveFacilityRow, TrialForm } from "../types";
import { apiFetch, postJson } from "./api";
import { parseRegionKey } from "../utils/region";

export async function streamRun(
  form: TrialForm,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await apiFetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...form,
      regions: form.regions.map(parseRegionKey),
    }),
    signal,
  });
  if (!res.body) {
    throw new Error("Streaming not supported by this browser/response.");
  }
  return res;
}

export interface SiteAnalysisParams {
  indication: string;
  phase?: string;
  sampleSize?: number | "";
  durationMonths?: number | "";
  budgetTier?: string;
  ageGroups?: string[];
  region: string;
  country: string;
  facilities: LiveFacilityRow[];
}

export async function streamSiteAnalysis(
  params: SiteAnalysisParams,
): Promise<Response> {
  const res = await apiFetch("/api/site-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.body) {
    throw new Error("Streaming not supported by this browser/response.");
  }
  return res;
}

export function fetchRecommendationForStatus(
  analysisId: string,
  status: string,
): Promise<FinalResult> {
  return postJson<FinalResult>(
    "/api/site-recommendation-by-status",
    { analysisId, status },
    "Could not load a recommendation for that status.",
  );
}
