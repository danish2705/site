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
  /** The exact live ClinicalTrials.gov rows already reviewed on the Ongoing Trials tab — see PipelineContext's `ongoingTrialSites`. */
  facilities: LiveFacilityRow[];
}

/**
 * Streams Stages 4-8 (Candidate Site Identification through Final
 * Recommendation) run over exactly `params.facilities`, instead of Stage 4
 * re-fetching its own live site list — see backend's
 * controllers/siteAnalysis.controller.ts.
 */
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

/**
 * Fetches the best-scored site for one live ClinicalTrials.gov status
 * ("RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING") from an
 * already-computed candidate pool, with its own AI recommendation — powers
 * the status dropdown on the Final Recommendation page. Cheap relative to
 * streamSiteAnalysis: no live ClinicalTrials.gov re-fetch, just one LLM
 * call server-side (see backend's siteRecommendation.controller.ts).
 */
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
