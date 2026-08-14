import { generateRecommendation, llmStatus } from "../llm/client.js";
import { scoreSites, explainScore, capConfidenceForEstimate } from "./scoring.js";
import type { ExtendedEvaluationRow } from "./scoring.js";
import {
  buildLiveCandidateSites,
  type LiveCandidateSite,
} from "./liveCandidateSites.js";
import { buildLiveRiskRecords } from "./liveRiskAssessment.js";
import { buildLiveTrialRequirement } from "./liveRequirements.js";
import { buildLiveRegionRow } from "./liveRegionMetrics.js";
import { resolveSpecialty } from "./liveIndications.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";
import type {
  PipelineInput,
  SendFn,
  RankedSite,
  RiskLevel,
  RiskRow,
  RiskRecord,
  RiskMatrix,
  RiskDriver,
  RiskExplanation,
  SiteRow,
  TrialRequirementRow,
  RequirementCheck,
} from "../types.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Standard 3x3 Likelihood x Impact risk matrix (industry-common convention),
// used only to show the "derivation" text on a risk driver. This replaces
// the Excel Risk_Matrix sheet — it is a fixed convention, not something any
// live API publishes, so it is defined here as a code-level constant
// instead (same rationale as data/regionMap.ts).
const RISK_MATRIX: RiskMatrix = {
  Low: { Low: "Low", Medium: "Low", High: "Medium" },
  Medium: { Low: "Low", Medium: "Medium", High: "High" },
  High: { Low: "Medium", Medium: "High", High: "High" },
};

function formatRiskDate(value: string | Date | number): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const EXCEL_EPOCH_OFFSET_DAYS = 25569; // days between 1899-12-30 and 1970-01-01
    const ms = Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  return String(value);
}

function toRiskRecord(r: RiskRow): RiskRecord {
  return {
    riskId: r["Risk ID"],
    siteId: r["Site ID"],
    category: r["Risk Category"],
    description: r.Description,
    likelihood: r.Likelihood,
    impact: r.Impact,
    overallRisk: r["Overall Risk Rating"],
    dateIdentified: formatRiskDate(r["Date Identified"]),
    status: r.Status,
    mitigationPlan: r["Mitigation Plan"],
    owner: r.Owner,
    riskScore: r["Risk Score (Numeric)"],
    dataSource: r.dataSource ?? "excel",
  };
}

const ACTIVE_STATUSES = new Set(["Open", "Monitoring"]);

function explainRisk(risks: RiskRow[], matrix: RiskMatrix): RiskExplanation {
  const at = (level: RiskLevel) =>
    risks.filter((r) => r["Overall Risk Rating"] === level);

  const highs = at("High");
  const mediums = at("Medium");
  const lows = at("Low");
  const total = risks.length;

  const level: RiskLevel =
    highs.length > 0 ? "High" : mediums.length > 0 ? "Medium" : "Low";

  const deciding =
    level === "High" ? highs : level === "Medium" ? mediums : lows;
  const activeAtLevel = deciding.filter((r) =>
    ACTIVE_STATUSES.has(r.Status),
  ).length;

  const isActive = (r: RiskRow) => ACTIVE_STATUSES.has(r.Status);
  const drivers: RiskDriver[] = [...deciding]
    .sort((a, b) => {
      const activeDiff = Number(isActive(b)) - Number(isActive(a));
      if (activeDiff !== 0) return activeDiff;
      return b["Risk Score (Numeric)"] - a["Risk Score (Numeric)"];
    })
    .slice(0, 4)
    .map((r) => {
      const derived = matrix?.[r.Likelihood]?.[r.Impact];
      return {
        riskId: r["Risk ID"],
        category: r["Risk Category"],
        description: r.Description,
        likelihood: r.Likelihood,
        impact: r.Impact,
        rating: r["Overall Risk Rating"],
        status: r.Status,
        active: isActive(r),
        derivation:
          `Likelihood ${r.Likelihood} × Impact ${r.Impact} → ` +
          `${derived ?? r["Overall Risk Rating"]}` +
          (derived ? " (per the Risk Matrix)" : ""),
      };
    });

  const categoryCounts = [...new Set(risks.map((r) => r["Risk Category"]))]
    .map((category) => {
      const inCat = risks.filter((r) => r["Risk Category"] === category);
      return {
        category,
        high: inCat.filter((r) => r["Overall Risk Rating"] === "High").length,
        medium: inCat.filter((r) => r["Overall Risk Rating"] === "Medium")
          .length,
        low: inCat.filter((r) => r["Overall Risk Rating"] === "Low").length,
      };
    })
    .sort((a, b) => b.high - a.high || b.medium - a.medium);

  let rule: string;
  if (total === 0) {
    rule = "Rated Low by default — no risk records are on file for this site.";
  } else if (level === "High") {
    rule =
      `Rated High because ${highs.length} of ${total} risk record(s) are individually rated High. ` +
      `A site takes the worst rating among its records, so a single High record sets the whole site to High.`;
  } else if (level === "Medium") {
    rule =
      `Rated Medium because no record is rated High, but ${mediums.length} of ${total} are rated Medium. ` +
      `A site takes the worst rating among its records.`;
  } else {
    rule = `Rated Low because all ${total} risk record(s) are individually rated Low.`;
  }

  const topCategory = categoryCounts[0];
  const concentration =
    level !== "Low" &&
    topCategory &&
    topCategory[level === "High" ? "high" : "medium"] > 0
      ? ` Most concentrated in ${topCategory.category}.`
      : "";

  const summary =
    total === 0
      ? "No risk records on file."
      : `${deciding.length} ${level} record(s) of ${total} total — ` +
        `${activeAtLevel} still open or being monitored, ` +
        `${deciding.length - activeAtLevel} already mitigated or closed.${concentration}`;

  return {
    level,
    rule,
    summary,
    totalRecords: total,
    highCount: highs.length,
    mediumCount: mediums.length,
    lowCount: lows.length,
    activeAtLevel,
    drivers,
    driverTotal: deciding.length,
    categoryCounts,
  };
}

function checkRequirements(
  site: SiteRow,
  evalRow: ExtendedEvaluationRow,
  requirement: TrialRequirementRow | undefined,
): RequirementCheck[] {
  if (!requirement) return [];

  const checks: RequirementCheck[] = [];

  const numeric = (
    criterion: string,
    actual: number | null | undefined,
    limit: number | null,
    cmp: "min" | "max",
    unit: string,
  ) => {
    if (limit === null || limit === undefined) return;
    const required = `${cmp === "min" ? "≥" : "≤"} ${limit}${unit}`;
    if (actual === null || actual === undefined) {
      checks.push({ criterion, required, actual: "no data", pass: false });
      return;
    }
    checks.push({
      criterion,
      required,
      actual: `${actual}${unit}`,
      pass: cmp === "min" ? actual >= limit : actual <= limit,
    });
  };

  numeric(
    "Enrollment rate",
    evalRow["Historical Enrollment Rate (pts/month)"],
    requirement["Min Enrollment Rate (pts/month)"],
    "min",
    " pts/mo",
  );
  numeric(
    "Dropout rate",
    evalRow["Dropout Rate (%)"],
    requirement["Max Acceptable Dropout (%)"],
    "max",
    "%",
  );
  numeric(
    "Data quality",
    evalRow["Data Quality Score (0-100)"],
    requirement["Min Data Quality Score"],
    "min",
    "",
  );
  numeric(
    "Screen failure rate",
    evalRow["Screen Failure Rate (%)"],
    requirement["Max Acceptable Screen Failure (%)"],
    "max",
    "%",
  );

  if (requirement["Accreditation Required"] === "Yes") {
    const actual =
      site.Accreditation === "Yes"
        ? "Accredited"
        : site.Accreditation === "Unknown"
          ? "Unknown (live-sourced site)"
          : "Not accredited";
    checks.push({
      criterion: "Accreditation",
      required: "Required",
      actual,
      pass: site.Accreditation === "Yes",
    });
  }

  return checks;
}

const STEP_DELAY_MS = 450;

export const STAGE_NAMES: Record<number, string> = {
  1: "Clinical Trial Requirements",
  2: "Region / Country Selection",
  3: "Patient Population Analysis",
  4: "Candidate Site Identification",
  5: "Site Evaluation",
  6: "AI Risk Assessment",
  7: "Site Ranking",
  8: "Final Recommendation",
};

export async function runPipeline(
  input: PipelineInput,
  send: SendFn,
): Promise<void> {
  const { indication, phase, sampleSize } = input;

  if (!indication) {
    throw new Error(`Missing indication. Pick an indication before running the analysis.`);
  }
  const specialty = await resolveSpecialty(indication);

  const requirement = await buildLiveTrialRequirement({
    indication,
    specialty,
    phase,
    sampleSize,
    durationMonths: input.durationMonths,
  });
  const requirementIsEstimated = requirement.requirementSource === "mixed";
  send("stage", {
    stage: 1,
    name: STAGE_NAMES[1],
    status: "complete",
    detail:
      `${indication} · ${phase || requirement.Phase} · target n=${sampleSize || requirement["Target Sample Size"]} · ${specialty} site required` +
      (requirementIsEstimated
        ? " · data-quality/screen-failure thresholds (AI-estimated)"
        : "") +
      (requirement.requirementWarning ? ` — ${requirement.requirementWarning}` : ""),
    data: {
      trialId: requirement["Trial ID"],
      indication,
      requiredSpecialty: specialty,
      requiredInfrastructure: requirement["Required Infrastructure"],
      phase: phase || requirement.Phase,
      targetSampleSize: sampleSize || requirement["Target Sample Size"],
      durationMonths:
        input.durationMonths || requirement["Duration (months)"],
      budgetTier: input.budgetTier || requirement["Budget Tier"],
      thresholds: {
        minEnrollmentRate: requirement["Min Enrollment Rate (pts/month)"],
        maxDropout: requirement["Max Acceptable Dropout (%)"],
        minDataQuality: requirement["Min Data Quality Score"],
        maxScreenFailure: requirement["Max Acceptable Screen Failure (%)"],
        accreditationRequired: requirement["Accreditation Required"],
      },
      requirementSource: requirement.requirementSource ?? "live",
    },
  });
  await sleep(STEP_DELAY_MS);

  send("stage", { stage: 2, name: STAGE_NAMES[2], status: "in-progress" });

  const userSelectedRegions = (input.regions || []).filter(
    (r) => r && r.region && r.country,
  );
  const regionDefs =
    userSelectedRegions.length > 0
      ? userSelectedRegions.map((r) => ({ region: r.region, country: r.country }))
      : REGION_DEFINITIONS;

  // Every defined region/country is now considered for every indication —
  // there is no more per-indication Region_Data to filter against. Live
  // data (competing trials) and LLM estimates (prevalence/regulatory/cost)
  // determine each region's fit, fetched in parallel per region.
  const regionRows = await Promise.all(
    regionDefs.map((def) =>
      buildLiveRegionRow({
        region: def.region,
        country: def.country,
        indication,
        specialty,
      }),
    ),
  );
  if (regionRows.length === 0) {
    throw new Error(
      `No region/country options are configured (see backend/src/data/regionMap.ts), so there is nothing to select from for indication "${indication}".`,
    );
  }

  const regionMetricsWarnings = regionRows
    .filter((r) => r.metricsWarning)
    .map((r) => r.metricsWarning as string);

  const rankedRegions = [...regionRows].sort((a, b) => {
    const scoreOf = (r: typeof a) =>
      r["Prevalence (per 100k)"] -
      r["Regulatory Approval Time (weeks)"] * 5 -
      r["Active Competing Trials"] * 3;
    return scoreOf(b) - scoreOf(a);
  });

  // Live candidate sites are discovered AFTER a region is picked (Stage 4,
  // below) — there is no more Excel Candidate_Sites list to pre-filter
  // eligible regions against, so the top-scoring region by the formula
  // above is simply selected. If Stage 4 then finds zero live candidates
  // there, the existing empty-candidate check below throws a clear error.
  const topRegion = rankedRegions[0];
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 2,
    name: STAGE_NAMES[2],
    status: "complete",
    detail:
      (userSelectedRegions.length > 0
        ? `Selected ${topRegion.Region}, ${topRegion.Country} (top-scoring among your ${userSelectedRegions.length} chosen option(s))`
        : `Selected ${topRegion.Region}, ${topRegion.Country} (top-scoring of ${rankedRegions.length} regions considered — no region/country input given)`) +
      (topRegion.regionMetricsSource === "llm-estimated"
        ? " · Prevalence/Regulatory/Cost figures (AI-estimated)"
        : "") +
      (regionMetricsWarnings.length > 0
        ? ` — ${regionMetricsWarnings.length} region(s) missing Prevalence/Regulatory/Cost data (see warnings)`
        : ""),
    data: rankedRegions.slice(0, 5).map((r) => ({
      region: r.Region,
      country: r.Country,
      prevalence: r["Prevalence (per 100k)"],
      regulatoryWeeks: r["Regulatory Approval Time (weeks)"],
      competingTrials: r["Active Competing Trials"],
      competingTrialsSource: r.competingTrialsSource ?? "live",
      regionMetricsSource: r.regionMetricsSource ?? "unavailable",
    })),
    warnings: regionMetricsWarnings,
  });

  send("stage", { stage: 3, name: STAGE_NAMES[3], status: "in-progress" });

  const ASSUMED_CATCHMENT = 5_000_000;
  const estimatedPatients = Math.round(
    (topRegion["Prevalence (per 100k)"] / 100000) * ASSUMED_CATCHMENT,
  );
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 3,
    name: STAGE_NAMES[3],
    status: "complete",
    detail:
      `~${estimatedPatients.toLocaleString()} estimated eligible patients (illustrative)` +
      (topRegion.regionMetricsSource === "llm-estimated"
        ? " — based on an (AI-estimated) prevalence figure"
        : ""),
  });

  send("stage", { stage: 4, name: STAGE_NAMES[4], status: "in-progress" });
  // Candidate sites are sourced live from ClinicalTrials.gov only — the
  // Excel Candidate_Sites sheet is intentionally not used here.
  let liveCandidates: LiveCandidateSite[] = [];
  try {
    liveCandidates = await buildLiveCandidateSites({
      indication,
      specialty,
      region: topRegion.Region,
      country: topRegion.Country,
      regulatoryWeeks: topRegion["Regulatory Approval Time (weeks)"],
      regionCompetingTrials: topRegion["Active Competing Trials"],
      avgCostPerPatient: topRegion["Avg Cost per Patient (USD)"],
    });
  } catch (err) {
    console.warn(
      `[live-sites] Could not fetch live facilities for "${indication}" in ${topRegion.Country}: ${(err as Error).message}`,
    );
  }

  const liveSiteWarnings = liveCandidates
    .filter((c) => c.warning)
    .map((c) => c.warning as string);
  const liveEvalById = new Map(
    liveCandidates
      .filter((c) => c.evalRow)
      .map((c) => [c.site["Site ID"], c.evalRow as ExtendedEvaluationRow]),
  );
  const liveCandidateBySiteId = new Map(
    liveCandidates.map((c) => [c.site["Site ID"], c]),
  );
  const candidateSites: SiteRow[] = liveCandidates.map((c) => c.site);

  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 4,
    name: STAGE_NAMES[4],
    status: "complete",
    detail:
      `${candidateSites.length} candidate site(s) found in ${topRegion.Region}, live from ClinicalTrials.gov` +
      (liveSiteWarnings.length > 0
        ? ` — ${liveSiteWarnings.length} could not be scored (see warnings)`
        : ""),
    data: candidateSites.map((s) => ({
      siteId: s["Site ID"],
      siteName: s["Site Name"],
      dataSource: s.dataSource ?? "live",
    })),
    warnings: liveSiteWarnings,
  });

  if (candidateSites.length === 0) {
    throw new Error(
      `No live candidate sites found for ${specialty} in ${topRegion.Region} on ClinicalTrials.gov. Try a different indication or region/country selection.`,
    );
  }

  send("stage", { stage: 5, name: STAGE_NAMES[5], status: "in-progress" });

  // Candidate sites are 100% live-sourced at this point (buildLiveCandidateSites
  // above), so every eval row is looked up from liveEvalById only — there is
  // no Excel-backed fallback map to fall through to anymore.
  const getEvalRow = (siteId: string): ExtendedEvaluationRow | undefined =>
    liveEvalById.get(siteId);

  const evalRows = candidateSites
    .map((s) => getEvalRow(s["Site ID"]))
    .filter((e): e is NonNullable<typeof e> => !!e);
  const scoredRaw = scoreSites(evalRows);
  const scoredById = new Map(
    scoredRaw.map((s, i) => [s.siteId, capConfidenceForEstimate(s, evalRows[i])]),
  );

  const evaluated = candidateSites
    .map((site) => {
      const evalRow = getEvalRow(site["Site ID"]);
      const scored = evalRow ? scoredById.get(site["Site ID"]) : undefined;
      if (!evalRow || !scored) return null; // no evaluation record on file
      return {
        ...site,
        siteId: site["Site ID"],
        siteName: site["Site Name"],
        suitabilityScore: evalRow["Suitability Score (0-100)"] ?? null,
        scored,
        evalRow,
        requirementChecks: checkRequirements(site, evalRow, requirement),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const meetingRequirements = evaluated.filter((s) =>
    s.requirementChecks.every((c) => c.pass),
  );
  const lowConfidence = evaluated.filter((s) => s.scored.confidence === "Low");

  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 5,
    name: STAGE_NAMES[5],
    status: "complete",
    detail:
      `Scored ${evaluated.length} site(s) on the weighted model` +
      ` — ${meetingRequirements.length} meet all protocol thresholds` +
      (lowConfidence.length
        ? `; ${lowConfidence.length} scored on incomplete data`
        : ""),
    data: evaluated.map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      score: s.scored.score,
      legacySuitabilityScore: s.suitabilityScore,
      components: s.scored.components,
      confidence: s.scored.confidence,
      completeness: s.scored.completeness,
      caveats: s.scored.caveats,
      requirementChecks: s.requirementChecks,
      meetsRequirements: s.requirementChecks.every((c) => c.pass),
      dataSource: s.evalRow.dataSource ?? "llm-estimated",
      estimateRationale: s.evalRow.estimateRationale ?? null,
    })),
  });

  send("stage", { stage: 6, name: STAGE_NAMES[6], status: "in-progress" });
  const riskWarnings: string[] = [];
  const withRisk: RankedSite[] = await Promise.all(
    evaluated.map(async (site) => {
      const siteId = site["Site ID"];
      // candidateSites is 100% live-sourced (buildLiveCandidateSites, Stage 4
      // above), so every siteId is present in liveCandidateBySiteId — there
      // is no Excel-backed risk list to fall through to anymore.
      const live = liveCandidateBySiteId.get(siteId);
      if (!live) {
        throw new Error(
          `Internal error: site ${siteId} was not found among the live candidates built in Stage 4.`,
        );
      }
      const result = await buildLiveRiskRecords({
        siteId,
        facilityName: site["Site Name"],
        city: site.City || null,
        country: site.Country,
        indication,
        specialty,
        region: topRegion.Region,
        history: live.history,
      });
      const risks = result.risks;
      if (result.warning) riskWarnings.push(result.warning);
      const highCount = risks.filter(
        (r) => r["Overall Risk Rating"] === "High",
      ).length;
      const medCount = risks.filter(
        (r) => r["Overall Risk Rating"] === "Medium",
      ).length;
      const overallRisk: RiskLevel =
        highCount > 0 ? "High" : medCount > 0 ? "Medium" : "Low";
      return {
        ...site,
        risks,
        highRiskCount: highCount,
        mediumRiskCount: medCount,
        overallRisk,
        riskExplanation: explainRisk(risks, RISK_MATRIX),
      };
    }),
  );
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 6,
    name: STAGE_NAMES[6],
    status: "complete",
    detail:
      `Risk-scored ${withRisk.length} site(s) across ${withRisk.reduce((n, s) => n + s.risks.length, 0)} risk records` +
      (riskWarnings.length > 0
        ? ` — ${riskWarnings.length} live site(s) had partial risk data (see warnings)`
        : ""),
    data: withRisk.map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      region: s.Region,
      overallRisk: s.overallRisk,
      highRiskCount: s.highRiskCount,
      mediumRiskCount: s.mediumRiskCount,
      riskRecords: s.risks.map(toRiskRecord),
      dataSource: s.evalRow.dataSource ?? "llm-estimated",
    })),
    warnings: riskWarnings,
  });

  send("stage", { stage: 7, name: STAGE_NAMES[7], status: "in-progress" });
  const ranked = [...withRisk]
    .sort((a, b) => {
      const aOk = a.requirementChecks.every((c) => c.pass);
      const bOk = b.requirementChecks.every((c) => c.pass);
      if (aOk !== bOk) return aOk ? -1 : 1;
      return b.scored.score - a.scored.score;
    })
    .slice(0, 10);
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 7,
    name: STAGE_NAMES[7],
    status: "complete",
    detail:
      `Ranked on the weighted model (Recruitment 35% · Quality 25% · ` +
      `Retention 20% · Diversity 10% · Cost 10%)`,
    data: ranked.map((s, i) => ({
      rank: i + 1,
      siteId: s.siteId,
      siteName: s.siteName,
      region: s.Region,
      score: s.scored.score,
      components: s.scored.components,
      confidence: s.scored.confidence,
      caveats: s.scored.caveats,
      meetsRequirements: s.requirementChecks.every((c) => c.pass),
      failedCriteria: s.requirementChecks
        .filter((c) => !c.pass)
        .map((c) => c.criterion),
      suitabilityScore: s.suitabilityScore,
      riskLevel: s.overallRisk,
      highRiskCount: s.highRiskCount,
      dataSource: s.evalRow.dataSource ?? "llm-estimated",
    })),
  });

  if (ranked.length === 0) {
    throw new Error(
      "No candidate sites could be scored — every candidate is missing an evaluation record.",
    );
  }

  const status = llmStatus();
  send("stage", {
    stage: 8,
    name: STAGE_NAMES[8],
    status: "in-progress",
    llm: status.configured ? status.model : "mock (no API key configured)",
  });
  const top = ranked[0];
  const recommendation = await generateRecommendation({
    input,
    topRegion,
    estimatedPatients,
    top,
    riskExplanation: top.riskExplanation,
  });
  send("stage", {
    stage: 8,
    name: STAGE_NAMES[8],
    status: "complete",
    llm: recommendation.llm,
    data: {
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
      text: recommendation.text,
    },
  });
}
