import type { Request, Response } from "express";
import { getAnalysis } from "../pipeline/analysisCache.js";
import { buildFinalResultPayload } from "../pipeline/finalResult.js";
import { generateRecommendation } from "../llm/client.js";
import { badRequest, notFoundError } from "../utils/httpError.js";

const VALID_STATUSES = new Set([
  "RECRUITING",
  "NOT_YET_RECRUITING",
  "ACTIVE_NOT_RECRUITING",
]);

/**
 * POST /api/site-recommendation-by-status
 * Body: { analysisId: string, status: "RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING" }
 *
 * Powers the Final Recommendation page's status dropdown (see
 * components/recommendation/RecommendationPanel.tsx): re-uses the already
 * fully-scored candidate pool from a prior /api/run or /api/site-analysis
 * call (cached under `analysisId` — see analysisCache.ts) instead of
 * re-running Stages 4-6, picks the best-ranked site whose live
 * ClinicalTrials.gov status matches `status`, and generates a fresh AI
 * recommendation for just that one site.
 *
 * `ranked` is already sorted meets-requirements-first then score-desc
 * (see runSiteAnalysis's Stage 7) — the same order the Ranking page's own
 * status filter relies on — so the first match here is exactly the site
 * that would show as "rank 1" if the Ranking page were filtered to this
 * same status.
 */
export async function postSiteRecommendationByStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const analysisId =
    typeof body.analysisId === "string" ? body.analysisId : "";
  const statusInput = typeof body.status === "string" ? body.status : "";
  const status = statusInput.toUpperCase();

  if (!analysisId) {
    throw badRequest('Body field "analysisId" is required.');
  }
  if (!VALID_STATUSES.has(status)) {
    throw badRequest(
      `Body field "status" must be one of: ${[...VALID_STATUSES].join(", ")}.`,
    );
  }

  const analysis = getAnalysis(analysisId);
  if (!analysis) {
    throw notFoundError(
      "This analysis has expired or is no longer available — switch country (or re-run) to refresh it.",
    );
  }

  const top = analysis.ranked.find(
    (s) => (s.recruitingStatus ?? "").toUpperCase() === status,
  );
  if (!top) {
    throw notFoundError(
      `No candidate site with live status "${status}" was found in this pool.`,
    );
  }

  const recommendation = await generateRecommendation({
    input: analysis.input,
    topRegion: analysis.topRegion,
    estimatedPatients: analysis.estimatedPatients,
    top,
    riskExplanation: top.riskExplanation,
  });

  res.json(
    buildFinalResultPayload({
      topRegion: analysis.topRegion,
      estimatedPatients: analysis.estimatedPatients,
      top,
      recommendationText: recommendation.text,
      analysisId,
    }),
  );
}
