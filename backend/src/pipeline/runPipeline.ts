import { generateRecommendation, llmStatus } from "../llm/client.js";
import { scoreSites, explainScore, capConfidenceForEstimate } from "./scoring.js";
import type { ExtendedEvaluationRow } from "./scoring.js";
import {
  buildLiveCandidateSites,
  type LiveCandidateSite,
} from "./liveCandidateSites.js";
import { buildLiveRiskRecords } from "./liveRiskAssessment.js";
import {
  buildLiveTrialRequirement,
  type LiveTrialRequirementRow,
} from "./liveRequirements.js";
import { buildLiveRegionRow } from "./liveRegionMetrics.js";
import { resolveSpecialty } from "./liveIndications.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import { config } from "../config.js";
import type { LiveFacility } from "../services/ctgov.client.js";
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
  RegionRow,
  TrialRequirementRow,
  RequirementCheck,
} from "../types.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function toPositiveNumberOrUndefined(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

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
    standardReference: r["Standard Reference"] ?? null,
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
        standardReference: r["Standard Reference"] ?? null,
        derivation:
          `Likelihood ${r.Likelihood} × Impact ${r.Impact} → ` +
          `${derived ?? r["Overall Risk Rating"]}` +
          (derived
            ? " (per the ICH Q9 / ISO 31000 Likelihood × Impact risk matrix)"
            : ""),
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

export interface Stage1to3Result {
  indication: string;
  specialty: string;
  requirement: LiveTrialRequirementRow;
  topRegion: RegionRow;
  estimatedPatients: number;
  ageGroups?: string[];
}

/**
 * Stages 1-3: parse the trial's requirements, pick the best region/country,
 * and estimate the eligible patient population there. Split out from the
 * original single runPipeline() so a caller can review/replace what happens
 * next (Stage 4's candidate-site list) before continuing — see
 * runSiteAnalysis() below, which picks up exactly where this leaves off.
 */
export async function runPipelineStages1to3(
  input: PipelineInput,
  send: SendFn,
): Promise<Stage1to3Result> {
  const { indication, phase, ageGroups } = input;
  // Sanitize once at the entry — see toPositiveNumberOrUndefined above —
  // so a blank form field ("") never reaches the requirement builder or the
  // saved-run values as a literal empty string.
  const sampleSize = toPositiveNumberOrUndefined(input.sampleSize);
  const durationMonths = toPositiveNumberOrUndefined(input.durationMonths);

  if (!indication) {
    throw new Error(`Missing indication. Pick an indication before running the analysis.`);
  }
  const specialty = await resolveSpecialty(indication);

  const requirement = await buildLiveTrialRequirement({
    indication,
    specialty,
    phase,
    sampleSize,
    durationMonths,
    ageGroups,
  });
  const requirementIsEstimated = requirement.requirementSource === "mixed";
  send("stage", {
    stage: 1,
    name: STAGE_NAMES[1],
    status: "complete",
    detail:
      `${indication} · ${phase || requirement.Phase} · target n=${sampleSize || requirement["Target Sample Size"]} · ${specialty} site required · Age group: ${requirement["Age Group"]}` +
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
      ageGroups: ageGroups && ageGroups.length > 0 ? ageGroups : [],
      ageGroup: requirement["Age Group"],
      targetSampleSize: sampleSize || requirement["Target Sample Size"],
      durationMonths: durationMonths || requirement["Duration (months)"],
      budgetTier: input.budgetTier || requirement["Budget Tier"],
      thresholds: {
        minEnrollmentRate: requirement["Min Enrollment Rate (pts/month)"],
        maxDropout: requirement["Max Acceptable Dropout (%)"],
        minDataQuality: requirement["Min Data Quality Score"],
        maxScreenFailure: requirement["Max Acceptable Screen Failure (%)"],
        accreditationRequired: requirement["Accreditation Required"],
      },
      requirementSource: requirement.requirementSource ?? "live",
      // Real, disclosed eligibility criteria from one representative trial
      // for this indication (Srikanth's inclusion/exclusion-criteria ask) —
      // informational only, NOT applied to filter any eligible-patient
      // count elsewhere (see the field's doc comment on TrialRequirementRow
      // in types.ts for why).
      eligibility: {
        criteriaText: requirement.eligibilityCriteriaText ?? null,
        sex: requirement.eligibilitySex ?? null,
        minimumAge: requirement.eligibilityMinimumAge ?? null,
        maximumAge: requirement.eligibilityMaximumAge ?? null,
        healthyVolunteers: requirement.eligibilityHealthyVolunteers ?? null,
        sourceNctId: requirement.eligibilitySourceNctId ?? null,
      },
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
  // determine each region's fit, fetched per region.
  //
  // Bounded concurrency, not Promise.all — when no region/country is
  // pre-selected, regionDefs is every REGION_DEFINITIONS entry (~39), each
  // making a ClinicalTrials.gov call plus an LLM call. Unbounded, that's the
  // same request-burst pattern that was flooding clinicaltrials.gov/the LLM
  // provider with 429s in llm/regionPredictor.ts — same fix, same knob
  // (config.ctgov.regionConcurrency), just applied here too.
  const regionRows = await mapWithConcurrency(
    regionDefs,
    config.ctgov.regionConcurrency,
    (def) =>
      buildLiveRegionRow({
        region: def.region,
        country: def.country,
        indication,
        specialty,
      }),
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

  return { indication, specialty, requirement, topRegion, estimatedPatients, ageGroups };
}

export interface RunSiteAnalysisParams {
  input: PipelineInput;
  indication: string;
  specialty: string;
  requirement: LiveTrialRequirementRow;
  topRegion: RegionRow;
  estimatedPatients: number;
  ageGroups?: string[];
  /**
   * Real ClinicalTrials.gov facility rows to analyze — when provided (e.g.
   * exactly what the user reviewed on the Ongoing Trials tab), Stage 4 uses
   * this list instead of re-querying ClinicalTrials.gov itself. See
   * buildLiveCandidateSites's `facilities` param.
   */
  facilities?: LiveFacility[];
}

/**
 * Stages 4-8: build/score candidate sites, assess risk, rank, and recommend.
 * Picks up from runPipelineStages1to3()'s result. Kept as a separate
 * function (rather than inlined in runPipeline()) so /api/site-analysis can
 * call it directly with a caller-supplied `facilities` list — see
 * controllers/siteAnalysis.controller.ts.
 */
export async function runSiteAnalysis(
  params: RunSiteAnalysisParams,
  send: SendFn,
): Promise<void> {
  const {
    input,
    indication,
    specialty,
    requirement,
    topRegion,
    estimatedPatients,
    ageGroups,
    facilities,
  } = params;

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
      facilities,
      // Real fix: this used to only affect Stage 1's text label (see the
      // requirement["Age Group"] detail string above) — the actual
      // candidate sites feeding Stages 4-7 (Ongoing Trials, Risk Register,
      // Ranking, Final Recommendation) never filtered on it at all. Now
      // the same live StdAge filter used by the Site Map tab applies here
      // too, so every stage after this one is working from the same
      // age-eligible site list, not two different unrelated lists.
      ageGroups,
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
      liveKpiFields: s.evalRow.liveKpiFields ?? [],
    })),
  });

  // Risk Register and Ranking show sites of every real recruiting status
  // (Recruiting, Not Yet Recruiting, Completed, Terminated, etc.) — no
  // status is excluded server-side. Each site carries its real status
  // (site.recruitingStatus, surfaced below as `status`) so the UI can offer
  // its own status filter instead.
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
        nearbyCompetingTrials: live.nearbyCompetingTrials,
        history: live.history,
        facilityWideHistory: live.facilityWideHistory,
        benchmarkMedianSampleSize: live.benchmarkMedianSampleSize,
        resultsSignal: live.resultsSignal,
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
      // True only when the ENTIRE risk list for this site is the single
      // "no data available" placeholder (see liveRiskAssessment.ts) — not
      // when a site genuinely has one real Low-rated record. Used so the UI
      // can show "No Data" instead of a "Low Risk" badge that would look
      // identical to a site that was actually assessed and found clean.
      const riskDataUnavailable =
        risks.length === 1 && risks[0]["Risk Category"] === "Data Availability";
      return {
        ...site,
        risks,
        highRiskCount: highCount,
        mediumRiskCount: medCount,
        overallRisk,
        riskDataUnavailable,
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
      riskDataUnavailable: s.riskDataUnavailable,
      riskRecords: s.risks.map(toRiskRecord),
      dataSource: s.evalRow.dataSource ?? "llm-estimated",
      // Real, raw ClinicalTrials.gov status (e.g. "RECRUITING",
      // "NOT_YET_RECRUITING", "COMPLETED"...) — the UI derives its own
      // display label/color and offers its own status filter from this.
      status: s.recruitingStatus ?? null,
    })),
    warnings: riskWarnings,
  });

  send("stage", { stage: 7, name: STAGE_NAMES[7], status: "in-progress" });
  // Every scored candidate is ranked and returned — no top-N cap. The
  // Ranking page shows "X of Y site(s)" against the full candidate pool
  // (see runPipeline Stage 6's data), so silently dropping everyone past
  // rank 10 would make that count misleading and hide real candidates the
  // user asked to see.
  const ranked = [...withRisk].sort((a, b) => {
    const aOk = a.requirementChecks.every((c) => c.pass);
    const bOk = b.requirementChecks.every((c) => c.pass);
    if (aOk !== bOk) return aOk ? -1 : 1;
    return b.scored.score - a.scored.score;
  });
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
      liveKpiFields: s.evalRow.liveKpiFields ?? [],
      liveKpiSourceNctId: s.evalRow.liveKpiSourceNctId ?? null,
      raceBreakdown: s.evalRow.raceBreakdown ?? null,
      status: s.recruitingStatus ?? null,
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
      liveKpiFields: top.evalRow.liveKpiFields ?? [],
      text: recommendation.text,
    },
  });
}

/**
 * One-shot entry point used by POST /api/run: runs Stages 1-3 then
 * immediately continues into Stages 4-8 with a self-fetched candidate-site
 * list (no `facilities` override) — this is the original, unchanged
 * end-to-end behavior. A caller that wants Stage 4 to analyze a specific,
 * already-reviewed set of live sites (e.g. from the Ongoing Trials tab)
 * should call runPipelineStages1to3() and runSiteAnalysis() directly instead
 * — see controllers/siteAnalysis.controller.ts.
 */
export async function runPipeline(
  input: PipelineInput,
  send: SendFn,
): Promise<void> {
  const stage1to3 = await runPipelineStages1to3(input, send);
  await runSiteAnalysis({ input, ...stage1to3 }, send);
}
