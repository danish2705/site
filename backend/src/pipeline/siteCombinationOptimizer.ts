import type {
  SiteCombinationRequestSite,
  SiteCombinationResponse,
  SiteCombinationSelectedSite,
  SiteCombinationStrategyResult,
} from "../types.js";

function estimatedCostFor(
  site: SiteCombinationRequestSite,
  patientsTaken: number,
  avgCostPerPatientUsd: number | null,
): number | null {
  if (site.baseCostUsd != null && site.perPatientCostUsd != null) {
    return Math.round(site.baseCostUsd + patientsTaken * site.perPatientCostUsd);
  }
  if (avgCostPerPatientUsd !== null) {
    return Math.round(patientsTaken * avgCostPerPatientUsd);
  }
  return null;
}

function totalRiskWeightedScore(sites: SiteCombinationSelectedSite[]): {
  averageRiskScore: number | null;
  portfolioRiskScore: number | null;
} {
  const scored = sites.filter(
    (s): s is SiteCombinationSelectedSite & { riskScore: number } =>
      s.riskScore !== null,
  );
  if (scored.length === 0) {
    return { averageRiskScore: null, portfolioRiskScore: null };
  }
  const sum = scored.reduce((total, s) => total + s.riskScore, 0);
  const averageRiskScore = Math.round((sum / scored.length) * 10) / 10;

  const portfolioRiskScore =
    scored.length === sites.length
      ? Math.round(
          sites.reduce(
            (total, s) => total + s.patientsTaken * ((s.riskScore ?? 0) / 100),
            0,
          ) * 10,
        ) / 10
      : null;

  return { averageRiskScore, portfolioRiskScore };
}

function runStrategy(
  sites: SiteCombinationRequestSite[],
  targetEnrollment: number,
  avgCostPerPatientUsd: number | null,
  strategy:
    | "lowest-risk-first"
    | "lowest-cost-first"
    | "balanced"
    | "highest-capacity-first",
  label: string,
): SiteCombinationStrategyResult {

  const maxCostPerPatient = Math.max(
    1,
    ...sites.map((s) =>
      s.perPatientCostUsd != null
        ? s.perPatientCostUsd
        : (avgCostPerPatientUsd ?? 0),
    ),
  );
  const maxRisk = Math.max(1, ...sites.map((s) => s.riskScore ?? 0));
  const maxRecruitablePatients = Math.max(
    1,
    ...sites.map((s) => s.recruitablePatients),
  );

  const ordered = [...sites].sort((a, b) => {
    if (strategy === "highest-capacity-first") {
      return b.recruitablePatients - a.recruitablePatients;
    }
    if (strategy === "lowest-risk-first") {
      const ar = a.riskScore ?? 100;
      const br = b.riskScore ?? 100;
      if (ar !== br) return ar - br;
      return b.recruitablePatients - a.recruitablePatients;
    }
    if (strategy === "lowest-cost-first") {
      const ac = a.perPatientCostUsd ?? avgCostPerPatientUsd;
      const bc = b.perPatientCostUsd ?? avgCostPerPatientUsd;
      if (ac !== null && bc !== null && ac !== bc) return ac - bc;
      return b.recruitablePatients - a.recruitablePatients;
    }
    const aCost = a.perPatientCostUsd ?? avgCostPerPatientUsd ?? 0;
    const bCost = b.perPatientCostUsd ?? avgCostPerPatientUsd ?? 0;
    const aCapacityPenalty =
      1 - a.recruitablePatients / maxRecruitablePatients;
    const bCapacityPenalty =
      1 - b.recruitablePatients / maxRecruitablePatients;
    const aScore =
      (a.riskScore ?? maxRisk) / maxRisk +
      aCost / maxCostPerPatient +
      aCapacityPenalty;
    const bScore =
      (b.riskScore ?? maxRisk) / maxRisk +
      bCost / maxCostPerPatient +
      bCapacityPenalty;
    if (aScore !== bScore) return aScore - bScore;
    return b.recruitablePatients - a.recruitablePatients;
  });

  const selected: SiteCombinationSelectedSite[] = [];
  let totalPatients = 0;
  for (const site of ordered) {
    if (totalPatients >= targetEnrollment) break;
    if (site.recruitablePatients <= 0) continue;

    const remainingNeed = targetEnrollment - totalPatients;
    const patientsTaken = Math.min(site.recruitablePatients, remainingNeed);
    selected.push({
      siteId: site.siteId,
      siteName: site.siteName,
      patientsTaken,
      recruitablePatientsAvailable: site.recruitablePatients,
      riskScore: site.riskScore,
      estimatedCostUsd: estimatedCostFor(site, patientsTaken, avgCostPerPatientUsd),
    });
    totalPatients += patientsTaken;
  }

  const totalEstimatedCostUsd = selected.every((s) => s.estimatedCostUsd !== null)
    ? selected.reduce((sum, s) => sum + (s.estimatedCostUsd ?? 0), 0)
    : null;

  const { averageRiskScore, portfolioRiskScore } = totalRiskWeightedScore(selected);

  return {
    strategy,
    label,
    sites: selected,
    totalPatients,
    totalEstimatedCostUsd,
    averageRiskScore,
    portfolioRiskScore,
    meetsTarget: totalPatients >= targetEnrollment,
  };
}

export function optimizeSiteCombination(
  sites: SiteCombinationRequestSite[],
  targetEnrollment: number,
  avgCostPerPatientUsd: number | null,
  assumedConsentRate: number,
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
      "Lowest cost first — accumulate the cheapest-per-patient sites until the target is met",
    ),
    runStrategy(
      sites,
      targetEnrollment,
      avgCostPerPatientUsd,
      "balanced",
      "Balanced — weighs risk, cost, and recruitment capacity evenly rather than optimizing any one alone",
    ),
    runStrategy(
      sites,
      targetEnrollment,
      avgCostPerPatientUsd,
      "highest-capacity-first",
      "Fewest sites — accumulate the highest-recruitable-patient sites first, regardless of risk or cost",
    ),
  ];

  const meeting = strategies.filter((s) => s.meetsTarget);
  const totalRecruitable = sites.reduce(
    (sum, s) => sum + Math.max(0, s.recruitablePatients),
    0,
  );

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
    const sRisk = s.portfolioRiskScore ?? s.averageRiskScore ?? 100;
    const rRisk = recommended.portfolioRiskScore ?? recommended.averageRiskScore ?? 100;
    if (sRisk < rRisk) {
      recommended = s;
    }
  }

  return {
    targetEnrollment,
    avgCostPerPatientUsd,
    assumedConsentRate,
    strategies,
    recommendedStrategy: recommended?.strategy ?? null,
    method:
      "Greedy accumulation, not an exhaustive combinatorial search: each " +
      "strategy sorts candidate sites by one criterion and adds sites one " +
      "at a time — taking only as many patients from the last site as are " +
      "needed to close the remaining gap — until the cumulative recruitable " +
      "patient count clears the target. This will not always find the true " +
      "minimum-cost or minimum-risk combination (that requires searching " +
      "all subsets, which is exponential in the number of candidate sites) " +
      "— treat it as a fast, explainable starting point for comparison, not " +
      "a proven optimum.",
    warnings,
  };
}
