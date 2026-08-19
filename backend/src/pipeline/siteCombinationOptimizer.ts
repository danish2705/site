import type {
  SiteCombinationRequestSite,
  SiteCombinationResponse,
  SiteCombinationStrategyResult,
} from "../types.js";

function averageRisk(sites: { riskScore: number | null }[]): number | null {
  const scored = sites.filter(
    (s): s is { riskScore: number } => s.riskScore !== null,
  );
  if (scored.length === 0) return null;
  const sum = scored.reduce((total, s) => total + s.riskScore, 0);
  return Math.round((sum / scored.length) * 10) / 10;
}

function runStrategy(
  sites: SiteCombinationRequestSite[],
  targetEnrollment: number,
  avgCostPerPatientUsd: number | null,
  strategy: "lowest-risk-first" | "lowest-cost-first",
  label: string,
): SiteCombinationStrategyResult {
  // Both strategies rank purely by risk today because no per-site cost
  // estimate exists yet (see the response's avgCostPerPatientUsd doc
  // comment) — "lowest-cost-first" falls back to greatest-patients-first
  // instead, which is the closest available proxy for "fewest sites/dollars
  // needed to hit the target" until a real per-site cost figure exists.
  const ordered = [...sites].sort((a, b) => {
    if (strategy === "lowest-risk-first") {
      const ar = a.riskScore ?? 100;
      const br = b.riskScore ?? 100;
      if (ar !== br) return ar - br;
      return b.netAvailablePatients - a.netAvailablePatients;
    }
    return b.netAvailablePatients - a.netAvailablePatients;
  });

  const selected: SiteCombinationRequestSite[] = [];
  let totalPatients = 0;
  for (const site of ordered) {
    if (totalPatients >= targetEnrollment) break;
    if (site.netAvailablePatients <= 0) continue;
    selected.push(site);
    totalPatients += site.netAvailablePatients;
  }

  const totalEstimatedCostUsd =
    avgCostPerPatientUsd !== null
      ? Math.round(
          Math.min(totalPatients, targetEnrollment) * avgCostPerPatientUsd,
        )
      : null;

  return {
    strategy,
    label,
    sites: selected.map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      netAvailablePatients: s.netAvailablePatients,
      riskScore: s.riskScore,
    })),
    totalPatients,
    totalEstimatedCostUsd,
    averageRiskScore: averageRisk(selected),
    meetsTarget: totalPatients >= targetEnrollment,
  };
}

export function optimizeSiteCombination(
  sites: SiteCombinationRequestSite[],
  targetEnrollment: number,
  avgCostPerPatientUsd: number | null,
): SiteCombinationResponse {
  const warnings: string[] = [];
  if (targetEnrollment <= 0) {
    warnings.push("Target enrollment must be greater than 0.");
  }

  const strategies: SiteCombinationStrategyResult[] = [
    runStrategy(
      sites,
      targetEnrollment,
      avgCostPerPatientUsd,
      "lowest-risk-first",
      "Lowest risk first — accumulate the least-risky sites until the target is met",
    ),
    runStrategy(
      sites,
      targetEnrollment,
      avgCostPerPatientUsd,
      "lowest-cost-first",
      "Fewest sites first — accumulate the highest-patient-count sites until the target is met",
    ),
  ];

  const meeting = strategies.filter((s) => s.meetsTarget);
  const totalNetAvailable = sites.reduce(
    (sum, s) => sum + Math.max(0, s.netAvailablePatients),
    0,
  );
  if (meeting.length === 0 && totalNetAvailable < targetEnrollment) {
    warnings.push(
      `Even combining every candidate site, only ~${totalNetAvailable.toLocaleString()} net-available patients were found against a target of ${targetEnrollment.toLocaleString()} — consider a wider radius, more countries, or a lower enrollment target.`,
    );
  }

  // Prefer whichever strategy meets the target with fewer sites (less
  // operational overhead — each additional site means another set of
  // inspections/monitoring visits, per the call's own cost-of-sites point);
  // tie-break on lower total cost, then lower average risk.
  let recommended: SiteCombinationStrategyResult | null = null;
  for (const s of meeting) {
    if (!recommended) {
      recommended = s;
      continue;
    }
    if (s.sites.length !== recommended.sites.length) {
      if (s.sites.length < recommended.sites.length) recommended = s;
      continue;
    }
    const sCost = s.totalEstimatedCostUsd ?? Infinity;
    const rCost = recommended.totalEstimatedCostUsd ?? Infinity;
    if (sCost !== rCost) {
      if (sCost < rCost) recommended = s;
      continue;
    }
    if ((s.averageRiskScore ?? 100) < (recommended.averageRiskScore ?? 100)) {
      recommended = s;
    }
  }

  return {
    targetEnrollment,
    avgCostPerPatientUsd,
    strategies,
    recommendedStrategy: recommended?.strategy ?? null,
    method:
      "Greedy accumulation, not an exhaustive combinatorial search: each " +
      "strategy sorts candidate sites by one criterion and adds sites one " +
      "at a time until the cumulative net-available patient count clears " +
      "the target. This will not always find the true minimum-cost or " +
      "minimum-risk combination (that requires searching all subsets, " +
      "which is exponential in the number of candidate sites) — treat it " +
      "as a fast, explainable starting point for comparison, not a proven optimum.",
    warnings,
  };
}
