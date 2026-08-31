import type { RegionRow } from "../types.js";
import { getActiveCompetingTrialsCount } from "../services/ctgov.client.js";
import { estimateRegionMetrics, llmStatus } from "../llm/client.js";
import { config } from "../config.js";
import { getClaimsRegionMetrics } from "./claimsRegionMetrics.js";

export interface BuildLiveRegionRowParams {
  region: string;
  country: string;
  indication: string;
  specialty: string;
}

interface MetricsCacheEntry {
  fields: {
    prevalencePer100k: number | null;
    regulatoryApprovalWeeks: number | null;
    avgCostPerPatientUsd: number | null;
  };
  rationale: string;
  expiresAt: number;
}
const metricsCache = new Map<string, MetricsCacheEntry>();

export async function buildLiveRegionRow(
  params: BuildLiveRegionRowParams,
): Promise<RegionRow> {
  const competingCountRaw = await getActiveCompetingTrialsCount(
    params.indication,
    params.country,
  );
  const competingTrials = competingCountRaw ?? 0;

  const cacheKey = `${params.region}|${params.country}|${params.indication}`.toLowerCase();
  let prevalence = 0;
  let regulatoryWeeks = 0;
  let avgCostPerPatient = 0;
  let regionMetricsSource: RegionRow["regionMetricsSource"] = "unavailable";
  let metricsWarning: string | undefined;

  const claimsMetrics = getClaimsRegionMetrics(params.indication, params.country);
  if (claimsMetrics) {
    return {
      Region: params.region,
      Country: params.country,
      Indication: params.indication,
      "Prevalence (per 100k)": claimsMetrics.prevalencePer100k,
      "Regulatory Approval Time (weeks)": claimsMetrics.regulatoryApprovalWeeks,
      "Active Competing Trials": competingTrials,
      "Avg Cost per Patient (USD)": claimsMetrics.avgCostPerPatientUsd,
      competingTrialsSource: "live",
      regionMetricsSource: "claims-synthetic",
      metricsWarning: undefined,
    };
  }

  const cached = metricsCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    prevalence = cached.fields.prevalencePer100k ?? 0;
    regulatoryWeeks = cached.fields.regulatoryApprovalWeeks ?? 0;
    avgCostPerPatient = cached.fields.avgCostPerPatientUsd ?? 0;
    regionMetricsSource = "llm-estimated";
  } else if (llmStatus().configured) {
    try {
      const estimate = await estimateRegionMetrics({
        region: params.region,
        country: params.country,
        indication: params.indication,
        specialty: params.specialty,
      });
      metricsCache.set(cacheKey, {
        fields: estimate.fields,
        rationale: estimate.rationale,
        expiresAt: Date.now() + config.ctgov.cacheTtlMs,
      });
      prevalence = estimate.fields.prevalencePer100k ?? 0;
      regulatoryWeeks = estimate.fields.regulatoryApprovalWeeks ?? 0;
      avgCostPerPatient = estimate.fields.avgCostPerPatientUsd ?? 0;
      regionMetricsSource = "llm-estimated";
      if (estimate.fields.prevalencePer100k === null) {
        metricsWarning = `${params.region}, ${params.country}: LLM returned prevalencePer100k=null for "${params.indication}" (it estimated the other fields but said it had no basis for prevalence) — Gross Eligible/Available/Expected Recruitment are all shown as 0 for every site in this country as a direct result.`;
      }
    } catch (err) {
      console.error(
        `[liveRegionMetrics] estimateRegionMetrics threw for ${params.region}, ${params.country}, "${params.indication}":`,
        err,
      );
      metricsWarning = `${params.region}, ${params.country}: LLM region-metrics estimate failed (${(err as Error).message}) (AI-estimated fields unavailable) — Prevalence/Regulatory/Cost shown as 0.`;
    }
  } else {
    metricsWarning = `${params.region}, ${params.country}: LLM not configured — no public source exists for Prevalence/Regulatory/Cost at this granularity, so these fields are unavailable (shown as 0).`;
  }

  return {
    Region: params.region,
    Country: params.country,
    Indication: params.indication,
    "Prevalence (per 100k)": prevalence,
    "Regulatory Approval Time (weeks)": regulatoryWeeks,
    "Active Competing Trials": competingTrials,
    "Avg Cost per Patient (USD)": avgCostPerPatient,
    competingTrialsSource: "live",
    regionMetricsSource,
    metricsWarning,
  };
}
