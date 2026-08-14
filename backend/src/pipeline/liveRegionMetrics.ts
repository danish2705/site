/**
 * Builds a live RegionRow for a region/country/indication combination.
 *
 * - Active Competing Trials: always real, from ClinicalTrials.gov
 *   (getActiveCompetingTrialsCount). Falls back to 0 if the lookup returns
 *   null; competingTrialsSource is always "live" since a null result still
 *   means "we asked the live API," not "we used Excel."
 * - Prevalence / Regulatory Approval Time / Avg Cost per Patient: no public
 *   source exists for these at this granularity (confirmed) — LLM-estimated
 *   via estimateRegionMetrics when an LLM is configured, cached per
 *   region|country|indication. If the LLM is unconfigured or the call
 *   fails, these fields become 0 and the row is explicitly tagged
 *   regionMetricsSource: "unavailable" with a metricsWarning, rather than
 *   silently returning fabricated-looking zeros with no indication.
 */
import type { RegionRow } from "../types.js";
import { getActiveCompetingTrialsCount } from "../services/ctgov.client.js";
import { estimateRegionMetrics, llmStatus } from "../llm/client.js";
import { config } from "../config.js";

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
    } catch (err) {
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
