import {
  loadStore,
  INDICATION_TO_SPECIALTY,
} from "../repository/excelStore.js";
import { generateRecommendation, llmStatus } from "../llm/client.js";
import { scoreSites, explainScore } from "./scoring.js";
import type { ExtendedEvaluationRow } from "./scoring.js";
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
    checks.push({
      criterion: "Accreditation",
      required: "Required",
      actual: site.Accreditation === "Yes" ? "Accredited" : "Not accredited",
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
  const store = loadStore();
  const { indication, phase, sampleSize } = input;

  if (!indication || !INDICATION_TO_SPECIALTY[indication]) {
    throw new Error(
      `Unknown or missing indication "${indication}". Valid options: ${store.indications.join(", ")}`,
    );
  }
  const specialty = INDICATION_TO_SPECIALTY[indication];

  const requirement = store.requirementByIndication.get(indication);
  send("stage", {
    stage: 1,
    name: STAGE_NAMES[1],
    status: "complete",
    detail: requirement
      ? `${indication} · ${phase || requirement.Phase} · target n=${sampleSize || requirement["Target Sample Size"]} · ${specialty} site required`
      : `${indication} · ${phase || "n/a"} · target n=${sampleSize || "n/a"} (no Trial_Requirements sheet — thresholds not applied)`,
    data: requirement
      ? {
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
        }
      : null,
  });
  await sleep(STEP_DELAY_MS);

  send("stage", { stage: 2, name: STAGE_NAMES[2], status: "in-progress" });
  let regionRows = store.regionData.filter((r) => r.Indication === indication);
  if (regionRows.length === 0) {
    throw new Error(`No Region_Data rows found for indication "${indication}"`);
  }

  const userSelectedRegions = (input.regions || []).filter(
    (r) => r && r.region && r.country,
  );
  if (userSelectedRegions.length > 0) {
    const selectedSet = new Set(
      userSelectedRegions.map((r) => `${r.region}||${r.country}`),
    );
    const filtered = regionRows.filter((r) =>
      selectedSet.has(`${r.Region}||${r.Country}`),
    );
    if (filtered.length === 0) {
      throw new Error(
        `None of your selected Region/Country options have data for indication "${indication}". ` +
          `Pick a different region/country combination for this indication.`,
      );
    }
    regionRows = filtered;
  }

  const rankedRegions = [...regionRows].sort((a, b) => {
    const scoreOf = (r: typeof a) =>
      r["Prevalence (per 100k)"] -
      r["Regulatory Approval Time (weeks)"] * 5 -
      r["Active Competing Trials"] * 3;
    return scoreOf(b) - scoreOf(a);
  });

  const bestByFormula = rankedRegions[0];
  const topRegion = rankedRegions.find((r) =>
    store.sites.some(
      (s) => s.Region === r.Region && s["Therapeutic Area"] === specialty,
    ),
  );
  if (!topRegion) {
    throw new Error(
      `No candidate sites found for ${specialty} (required by "${indication}") in any of the ` +
        `${rankedRegions.length} region(s) considered${
          userSelectedRegions.length > 0
            ? " among your selected Region/Country options"
            : ""
        }. Try a different indication or region/country selection.`,
    );
  }
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 2,
    name: STAGE_NAMES[2],
    status: "complete",
    detail:
      (userSelectedRegions.length > 0
        ? `Selected ${topRegion.Region}, ${topRegion.Country} (best fit with available sites among your ${userSelectedRegions.length} chosen option(s))`
        : `Selected ${topRegion.Region}, ${topRegion.Country} (auto-picked — no region/country input given)`) +
      (topRegion !== bestByFormula
        ? ` — ${bestByFormula.Region}, ${bestByFormula.Country} scored higher but had no ${specialty} candidate sites`
        : ""),
    data: rankedRegions.slice(0, 5).map((r) => ({
      region: r.Region,
      country: r.Country,
      prevalence: r["Prevalence (per 100k)"],
      regulatoryWeeks: r["Regulatory Approval Time (weeks)"],
      competingTrials: r["Active Competing Trials"],
    })),
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
    detail: `~${estimatedPatients.toLocaleString()} estimated eligible patients (illustrative)`,
  });

  send("stage", { stage: 4, name: STAGE_NAMES[4], status: "in-progress" });
  const candidateSites = store.sites.filter(
    (s) => s.Region === topRegion.Region && s["Therapeutic Area"] === specialty,
  );
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 4,
    name: STAGE_NAMES[4],
    status: "complete",
    detail: `${candidateSites.length} candidate site(s) found in ${topRegion.Region}`,
  });

  if (candidateSites.length === 0) {
    throw new Error(
      `No candidate sites found for ${specialty} in ${topRegion.Region}. Try a different indication.`,
    );
  }

  send("stage", { stage: 5, name: STAGE_NAMES[5], status: "in-progress" });

  const evalRows = candidateSites
    .map((s) => store.evalBySiteId.get(s["Site ID"]))
    .filter((e): e is NonNullable<typeof e> => !!e);
  const scoredById = new Map(scoreSites(evalRows).map((s) => [s.siteId, s]));

  const evaluated = candidateSites
    .map((site) => {
      const evalRow = store.evalBySiteId.get(site["Site ID"]);
      const scored = evalRow ? scoredById.get(site["Site ID"]) : undefined;
      if (!evalRow || !scored) return null; // no evaluation record on file
      return {
        ...site,
        siteId: site["Site ID"], 
        siteName: site["Site Name"], 
        suitabilityScore: evalRow["Suitability Score (0-100)"],
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
      (requirement
        ? ` — ${meetingRequirements.length} meet all protocol thresholds`
        : "") +
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
    })),
  });

  send("stage", { stage: 6, name: STAGE_NAMES[6], status: "in-progress" });
  const withRisk: RankedSite[] = evaluated.map((site) => {
    const risks = store.risksBySiteId.get(site["Site ID"]) || [];
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
      riskExplanation: explainRisk(risks, store.riskMatrix),
    };
  });
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 6,
    name: STAGE_NAMES[6],
    status: "complete",
    detail: `Risk-scored ${withRisk.length} site(s) across ${withRisk.reduce((n, s) => n + s.risks.length, 0)} risk records`,
    data: withRisk.map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      region: s.Region,
      overallRisk: s.overallRisk,
      highRiskCount: s.highRiskCount,
      mediumRiskCount: s.mediumRiskCount,
      riskRecords: s.risks.map(toRiskRecord),
    })),
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
      text: recommendation.text,
    },
  });
}
