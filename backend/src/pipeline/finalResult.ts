import { explainScore } from "./scoring.js";
import type { RankedSite, RegionRow } from "../types.js";

/**
 * Builds the exact payload shape the Final Recommendation page's
 * FinalResult expects (see frontend/src/types.ts) from a single ranked
 * candidate. Shared by runPipeline.ts's Stage 8 (the overall best site) and
 * siteRecommendation.controller.ts (the best site for one live status) so
 * the two never drift into two slightly different shapes.
 */
export function buildFinalResultPayload(params: {
  topRegion: RegionRow;
  estimatedPatients: number;
  top: RankedSite;
  recommendationText: string;
  /** Present when this result came from a cached, re-usable candidate pool
   * (see analysisCache.ts) — lets the frontend ask for a different live
   * status's top site without re-running Stages 4-6. Absent/omitted for
   * callers that don't have one to hand back. */
  analysisId?: string;
}) {
  const { topRegion, estimatedPatients, top, recommendationText, analysisId } =
    params;
  return {
    region: topRegion.Region,
    country: topRegion.Country,
    estimatedPatients,
    recommendedSite: top.siteName,
    siteId: top.siteId,
    score: top.scored.score,
    scoreExplanation: explainScore(top.scored),
    components: top.scored.components,
    confidence: top.scored.confidence,
    meetsRequirements: top.requirementChecks.every((c) => c.pass),
    requirementChecks: top.requirementChecks,
    suitabilityScore: top.suitabilityScore,
    riskLevel: top.overallRisk,
    highRiskCount: top.highRiskCount,
    riskExplanation: top.riskExplanation,
    dataSource: top.evalRow.dataSource ?? "llm-estimated",
    liveKpiFields: top.evalRow.liveKpiFields ?? [],
    text: recommendationText,
    analysisId,
    // Real, live ClinicalTrials.gov status of the recommended site — lets
    // the frontend know which status-dropdown slot this result belongs to
    // (see RecommendationPanel.tsx's normalizeStatus/default-status logic).
    status: top.recruitingStatus ?? null,
  };
}
