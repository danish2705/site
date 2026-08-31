import { explainScore } from "./scoring.js";
import type { RankedSite, RegionRow } from "../types.js";

export function buildFinalResultPayload(params: {
  topRegion: RegionRow;
  estimatedPatients: number;
  top: RankedSite;
  recommendationText: string;
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
    status: top.recruitingStatus ?? null,
  };
}
