/**
 * Builds risk-register rows for a live, ClinicalTrials.gov-sourced site.
 *
 * Every category here is REAL signal (dataSource: "live"), derived from
 * disclosed ClinicalTrials.gov data, no LLM involved:
 *   - trial-status history at that exact facility (terminated/withdrawn/
 *     suspended trials, with the sponsor-disclosed reason where available)
 *     -> Enrollment/Safety/Operational/Regulatory/Clinical categories. The
 *     shared Likelihood rate prefers a facility-wide (all-indications) trial
 *     sample when one is available, since the indication-scoped sample is
 *     often just 1-2 trials — see realRiskRecordsFrom.
 *   - per-facility count of nearby (same-city) actively-recruiting/
 *     not-yet-recruiting trial locations for this indication, computed
 *     in liveCandidateSites.ts from ClinicalTrials.gov's per-location
 *     status field -> Competitive category. (Distinct from the
 *     country-wide "Active Competing Trials" figure used for
 *     region-level scoring — that one number is the same for every site
 *     in a run, so it isn't fine-grained enough for a per-site rating.)
 *   - overdue/missing results reporting at this facility's past trials
 *     (HasResults + PrimaryCompletionDate, both disclosed fields) ->
 *     Data Integrity category. Also prefers the facility-wide sample.
 *   - a facility's own ACTUAL enrollment counts vs. the completed-trial
 *     benchmark median for this indication -> Enrollment-shortfall signal,
 *     folded into the Enrollment category (see enrollmentShortfallRiskRecordFrom).
 *   - the design attributes (masking, allocation, intervention model) of
 *     this facility's own trials for this indication -> Protocol Complexity
 *     category (see protocolComplexityRiskRecordFrom).
 *   - how long ago the sponsor last verified/updated this facility's trial
 *     records -> Reporting Diligence category (see
 *     reportingDiligenceRiskRecordFrom) — a real, disclosed proxy for
 *     disclosure diligence, NOT the same thing as a GCP compliance
 *     inspection finding (no such data exists publicly for any facility).
 *
 * Compliance (the old AI-guessed category) has been dropped entirely — see
 * the frontend's static disclaimer in RiskAssessmentAccordion.tsx for why.
 * Staff Turnover was dropped earlier for the same reason: no real source
 * exists for it and there was no way to ground even a plausible estimate.
 *
 * Every one of the 5 code-computed categories above (Competitive, Data
 * Integrity, Enrollment Shortfall, Protocol Complexity, Reporting
 * Diligence) is ALWAYS included in a site's risk register, even when no
 * real signal was found — a clean category comes back as a Likelihood
 * Low / Impact Low row (rendered "No Risk", green, on the frontend)
 * instead of being silently skipped, so no risk category is ever missing
 * from a site's output. The single "Data Availability" placeholder below
 * is now only a defensive fallback (in practice unreachable, since the 5
 * categories always produce a row).
 */
import type { RiskRow } from "../types.js";
import type { FacilityHistory, FacilityTrialRecord } from "../services/ctgov.client.js";

const TERMINAL_STATUSES = new Set(["TERMINATED", "WITHDRAWN", "SUSPENDED"]);

// Same fixed Likelihood x Impact convention used for the "derivation" text in
// runPipeline.ts's RISK_MATRIX — duplicated here (not imported) to avoid a
// circular import between runPipeline.ts and this module. Used for every
// code-computed category below (Competitive, Data Integrity, Enrollment
// Shortfall, Protocol Complexity, Reporting Diligence), not for the
// trial-history-derived categories, which set their own Overall rating
// directly from a per-trial Impact.
const RISK_MATRIX: Record<"Low" | "Medium" | "High", Record<"Low" | "Medium" | "High", "Low" | "Medium" | "High">> = {
  Low: { Low: "Low", Medium: "Low", High: "Medium" },
  Medium: { Low: "Low", Medium: "Medium", High: "High" },
  High: { Low: "Medium", Medium: "High", High: "High" },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole months between an ISO-ish date string and today; null if unparseable. */
function monthsSince(dateStr: string): number | null {
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return null;
  const days = (Date.now() - then.getTime()) / MS_PER_DAY;
  return days / 30.44;
}

function categorizeWhyStopped(whyStopped: string | null): string {
  const w = (whyStopped ?? "").toLowerCase();
  if (/enroll|recruit|accrual/.test(w)) return "Enrollment";
  if (/safety|adverse|toxicit/.test(w)) return "Safety";
  if (/fund|budget|sponsor|business/.test(w)) return "Operational";
  if (/regulat|approval|complian/.test(w)) return "Regulatory";
  if (/efficacy|futility|interim/.test(w)) return "Clinical";
  return "Operational";
}

function riskScoreFor(rating: "Low" | "Medium" | "High"): number {
  return rating === "High" ? 3 : rating === "Medium" ? 2 : 1;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Generic 0-1 proportion -> Low/Medium/High bander, reused for every
// facility-level rate below (termination rate, results-overdue rate). A
// facility where most of its trials ran into trouble gets a higher
// Likelihood than one with a single isolated incident; the threshold
// numbers themselves are still a stated convention (any Low/Medium/High
// banding needs one), but the rate they're applied to is always a real,
// live figure, never a fixed constant.
function bandRate(rate: number): "Low" | "Medium" | "High" {
  if (rate >= 0.5) return "High";
  if (rate >= 0.2) return "Medium";
  return "Low";
}

function realRiskRecordsFrom(
  siteId: string,
  history: FacilityHistory | undefined,
  facilityWideHistory?: FacilityHistory | null,
): { risks: RiskRow[]; summary: string } {
  if (!history || history.trials.length === 0) {
    return { risks: [], summary: "No prior trial history found at this facility." };
  }

  const terminal = history.trials.filter(
    (t) => t.overallStatus && TERMINAL_STATUSES.has(t.overallStatus),
  );

  if (terminal.length === 0) {
    return {
      risks: [],
      summary: `${history.trials.length} prior trial(s) at this facility, none terminated/withdrawn/suspended.`,
    };
  }

  // The indication-scoped `history` is often just 1-2 trials, which makes a
  // termination rate noisy. When a broader, facility-wide (all-indications)
  // sample is available and non-empty, use IT for the shared rate instead —
  // a bigger, steadier denominator — while still listing a row per
  // indication-specific terminal trial below (those descriptions stay
  // relevant to the indication actually being evaluated).
  const usingFacilityWide =
    !!facilityWideHistory && facilityWideHistory.trials.length > 0;
  const rateSource = usingFacilityWide ? facilityWideHistory! : history;
  const rateTerminal = rateSource.trials.filter(
    (t) => t.overallStatus && TERMINAL_STATUSES.has(t.overallStatus),
  );
  const terminationRate = rateTerminal.length / rateSource.trials.length;
  const likelihood = bandRate(terminationRate);
  const rateScopeText = usingFacilityWide
    ? "across all indications on file at this facility"
    : "on file at this facility";

  const risks: RiskRow[] = terminal.map((t) => {
    const category = categorizeWhyStopped(t.whyStopped);
    // Safety-related stoppages are treated as High impact regardless of the
    // exact status wording (a safety-driven termination and a safety-driven
    // withdrawal are both serious) — everything else keeps the existing
    // TERMINATED-is-worse-than-WITHDRAWN/SUSPENDED distinction. Both signals
    // (category, status) come from the real, disclosed `whyStopped` /
    // `overallStatus` fields, not an AI guess.
    const impact: "High" | "Medium" =
      category === "Safety" || t.overallStatus === "TERMINATED"
        ? "High"
        : "Medium";
    const overall = RISK_MATRIX[likelihood][impact];
    return {
      "Risk ID": `R-LIVE-${t.nctId || siteId}`,
      "Site ID": siteId,
      "Risk Category": category,
      Description:
        `Trial ${t.nctId}${t.briefTitle ? ` (${t.briefTitle})` : ""} at this facility was ` +
        `${t.overallStatus}${t.whyStopped ? `: ${t.whyStopped}` : " — no reason disclosed"}. ` +
        `${rateTerminal.length} of ${rateSource.trials.length} prior trial(s) ${rateScopeText} ` +
        `were terminated/withdrawn/suspended (${Math.round(terminationRate * 100)}%), which sets ` +
        `this facility's Likelihood to ${likelihood}.`,
      Likelihood: likelihood,
      Impact: impact,
      "Overall Risk Rating": overall,
      "Date Identified": today(),
      Status: "Open",
      "Mitigation Plan":
        "Confirm root cause with the site directly before allocating enrollment; " +
        "request updated staffing/enrollment plan if history repeats.",
      Owner: "Clinical Ops Manager",
      "Risk Score (Numeric)": riskScoreFor(overall),
      dataSource: "live",
    };
  });

  const summary =
    `${terminal.length} of ${history.trials.length} prior trial(s) at this facility were ` +
    `terminated/withdrawn/suspended (${Math.round(terminationRate * 100)}% termination rate, ` +
    `reasons: ${terminal.map((t) => t.whyStopped || "undisclosed").join("; ")}).`;

  return { risks, summary };
}

// Thresholds are a stated convention, not a public standard — recalibrated
// for a SAME-CITY count (typically small, since it's one facility's local
// competition), unlike the old country-wide total this replaced. A single
// nearby competing trial is already a meaningful signal at this granularity,
// so the bar for Medium/High is much lower than a country-level count would
// need. Documented here so the rule is visible/adjustable, same spirit as
// the Risk_Matrix convention.
function bandCompetingTrials(count: number): "Low" | "Medium" | "High" {
  if (count >= 3) return "High";
  if (count >= 1) return "Medium";
  return "Low";
}

/**
 * Real Competitive-risk record: derived from a real, per-facility count of
 * OTHER actively-recruiting/not-yet-recruiting trial locations for this
 * indication in the SAME CITY (computed in liveCandidateSites.ts from
 * ClinicalTrials.gov's per-location status field) — not an LLM guess, and
 * not the country-wide total used for region-level scoring, which would
 * have given every site in a run the identical rating regardless of how
 * crowded its own city actually is. Likelihood and Impact are both banded
 * off that one real number, and Overall comes from the same fixed matrix
 * convention used elsewhere, not a second guess.
 */
function competitiveRiskRecordFrom(
  siteId: string,
  nearbyCompetingTrials: number,
): RiskRow {
  // No nearby competing trials is a real, checked signal (zero found), not
  // an absence of data — always return a row for this category so it's
  // never silently missing from a site's risk register; the frontend shows
  // Likelihood/Impact Low + Low as "No Risk" (green).
  if (nearbyCompetingTrials <= 0) {
    return {
      "Risk ID": `R-COMPETE-${siteId}`,
      "Site ID": siteId,
      "Risk Category": "Competitive",
      Description:
        "No other actively recruiting or soon-to-recruit trial locations for this indication were " +
        "found on ClinicalTrials.gov in the same city — no competitive signal at this facility.",
      Likelihood: "Low",
      Impact: "Low",
      "Overall Risk Rating": "Low",
      "Date Identified": today(),
      Status: "Open",
      "Mitigation Plan":
        "No action needed now — recheck if new competing trials register in the same city as enrollment proceeds.",
      Owner: "Clinical Ops Manager",
      "Risk Score (Numeric)": riskScoreFor("Low"),
      dataSource: "live",
    };
  }
  const band = bandCompetingTrials(nearbyCompetingTrials);
  const overall = RISK_MATRIX[band][band];
  return {
    "Risk ID": `R-COMPETE-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Competitive",
    Description:
      `${nearbyCompetingTrials} other actively recruiting or soon-to-recruit trial location(s) ` +
      `for this indication were found on ClinicalTrials.gov in the same city, competing for the ` +
      `same patient pool.`,
    Likelihood: band,
    Impact: band,
    "Overall Risk Rating": overall,
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan":
      "Confirm this site's projected enrollment rate accounts for competing trials in the area; " +
      "consider a backup site if enrollment lags the benchmark.",
    Owner: "Clinical Ops Manager",
    "Risk Score (Numeric)": riskScoreFor(overall),
    dataSource: "live",
  };
}

const RESULTS_OVERDUE_MONTHS = 12; // FDAAA 801's usual reporting window for applicable trials
const RESULTS_SEVERELY_OVERDUE_MONTHS = 24;

/**
 * Real Data-Integrity-adjacent record: flags this facility's past trials
 * that are well past their primary completion date with no results posted
 * (HasResults + PrimaryCompletionDate — both disclosed ClinicalTrials.gov
 * fields, not an estimate). This reports the reporting-status FACT only —
 * it does not assert that FDAAA 801 legally applies to a given trial or
 * declare a compliance violation, since that depends on trial-specific
 * details (funding, product type) this data doesn't confirm.
 */
function dataIntegrityRiskRecordFrom(
  siteId: string,
  history: FacilityHistory | undefined,
  facilityWideHistory?: FacilityHistory | null,
): RiskRow {
  // No-signal row for this category — always returned instead of a skipped
  // category, so Data Integrity never silently disappears from a site's
  // risk register. Likelihood/Impact Low + Low renders as "No Risk" (green)
  // on the frontend.
  const noSignalRow = (reason: string): RiskRow => ({
    "Risk ID": `R-DATAINTEG-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Data Integrity",
    Description: reason,
    Likelihood: "Low",
    Impact: "Low",
    "Overall Risk Rating": "Low",
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan": "No action needed — no overdue results-reporting signal found for this facility.",
    Owner: "Data Management Lead",
    "Risk Score (Numeric)": riskScoreFor("Low"),
    dataSource: "live",
  });

  // "Not reporting results on time" is a facility/sponsor behavior pattern,
  // not something specific to one indication, so this prefers the broader
  // facility-wide sample when available — same reasoning as the termination
  // rate above — falling back to the indication-scoped one otherwise.
  const usingFacilityWide =
    !!facilityWideHistory && facilityWideHistory.trials.length > 0;
  const source = usingFacilityWide ? facilityWideHistory! : history;
  if (!source || source.trials.length === 0) {
    return noSignalRow(
      "No trial history found at this facility to assess results-reporting timeliness.",
    );
  }
  const scopeText = usingFacilityWide
    ? "across all indications on file at this facility"
    : "at this facility";

  // Only trials that have actually reached their primary completion date are
  // even eligible to be judged on results-reporting timeliness — a trial
  // still recruiting hasn't missed anything yet, so it's excluded from both
  // the numerator and the denominator below, not counted as "on time."
  const eligible = source.trials.filter((t) => {
    if (!t.primaryCompletionDate) return false;
    const months = monthsSince(t.primaryCompletionDate);
    return months !== null && months >= 0;
  });
  if (eligible.length === 0) {
    return noSignalRow(
      `None of this facility's trials ${scopeText} have reached their primary completion date yet, ` +
        `so results-reporting timeliness cannot be assessed.`,
    );
  }

  const overdue = eligible.filter((t) => {
    if (t.hasResults !== false) return false; // null (unknown) or true (posted) — not flaggable
    const months = monthsSince(t.primaryCompletionDate as string);
    return months !== null && months >= RESULTS_OVERDUE_MONTHS;
  });
  if (overdue.length === 0) {
    return noSignalRow(
      `All ${eligible.length} eligible completed trial(s) ${scopeText} have results posted on ` +
        `ClinicalTrials.gov within ${RESULTS_OVERDUE_MONTHS} months of primary completion — no overdue signal.`,
    );
  }

  // Real, facility-level rate — same treatment as the termination rate
  // above — instead of a fixed "Medium" constant: what fraction of this
  // facility's completed trials are overdue on posting results.
  const overdueRate = overdue.length / eligible.length;
  const likelihood = bandRate(overdueRate);

  const severelyOverdueCount = overdue.filter((t) => {
    const months = monthsSince(t.primaryCompletionDate as string);
    return months !== null && months >= RESULTS_SEVERELY_OVERDUE_MONTHS;
  }).length;

  const impact: "High" | "Medium" =
    severelyOverdueCount > 0 ? "High" : "Medium";
  const overall = RISK_MATRIX[likelihood][impact];

  return {
    "Risk ID": `R-DATAINTEG-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Data Integrity",
    Description:
      `${overdue.length} of ${eligible.length} completed trial(s) ${scopeText} ` +
      `(${overdue.map((t) => t.nctId).join(", ")}) show no results posted on ClinicalTrials.gov ` +
      `more than ${RESULTS_OVERDUE_MONTHS} months after primary completion ` +
      `(${Math.round(overdueRate * 100)}% overdue rate, which sets this facility's Likelihood to ` +
      `${likelihood})` +
      (severelyOverdueCount > 0
        ? `, ${severelyOverdueCount} of them more than ${RESULTS_SEVERELY_OVERDUE_MONTHS} months overdue`
        : "") +
      `. This reports the reporting-status fact only, not a confirmed FDAAA violation — ` +
      `applicability depends on trial-specific details not available here.`,
    Likelihood: likelihood,
    Impact: impact,
    "Overall Risk Rating": overall,
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan":
      "Confirm current results-reporting status directly with the sponsor/investigator before " +
      "relying on this facility's data-transparency track record.",
    Owner: "Data Management Lead",
    "Risk Score (Numeric)": riskScoreFor(overall),
    dataSource: "live",
  };
}

// Band, not a public standard — a facility whose own ACTUAL enrollment came
// in under a quarter of the typical (median) completed trial for this
// indication is flagged High; under half is Medium. 0.5+ isn't flagged at
// all, same "absence of signal, not a Low rating" pattern as Competitive.
function bandEnrollmentRatio(ratio: number): "Low" | "Medium" | "High" | null {
  if (ratio < 0.25) return "High";
  if (ratio < 0.5) return "Medium";
  return null;
}

/**
 * Real Enrollment-shortfall record: compares this facility's own trials'
 * ACTUAL (not estimated/target) enrollment counts — a disclosed
 * EnrollmentCount + EnrollmentType field, not a guess — against the
 * completed-trial benchmark median sample size for this indication (already
 * fetched live for the LLM KPI estimate, reused here). Note this is a
 * per-STUDY figure, not broken down per site within a multi-site trial, so
 * it reflects "trials this facility took part in came in short," not
 * necessarily this facility's own individual enrollment — a real but
 * indirect signal, disclosed as such in the description.
 */
function enrollmentShortfallRiskRecordFrom(
  siteId: string,
  history: FacilityHistory | undefined,
  benchmarkMedianSampleSize: number | null,
): RiskRow {
  // No-signal row for this category — always returned instead of a skipped
  // category, so Enrollment (shortfall) never silently disappears from a
  // site's risk register. Likelihood/Impact Low + Low renders as "No Risk"
  // (green) on the frontend.
  const noSignalRow = (reason: string): RiskRow => ({
    "Risk ID": `R-ENROLLSHORT-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Enrollment",
    Description: reason,
    Likelihood: "Low",
    Impact: "Low",
    "Overall Risk Rating": "Low",
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan": "No action needed — no enrollment-shortfall signal found for this facility.",
    Owner: "Clinical Ops Manager",
    "Risk Score (Numeric)": riskScoreFor("Low"),
    dataSource: "live",
  });

  if (!history || !benchmarkMedianSampleSize || benchmarkMedianSampleSize <= 0) {
    return noSignalRow(
      "No completed-trial enrollment benchmark is available for this indication, so enrollment shortfall cannot be assessed.",
    );
  }
  const actualTrials = history.trials.filter(
    (t) => t.enrollmentType === "ACTUAL" && typeof t.enrollmentCount === "number",
  );
  if (actualTrials.length === 0) {
    return noSignalRow(
      "No trials with reported ACTUAL enrollment counts were found at this facility, so enrollment shortfall cannot be assessed.",
    );
  }

  const avgActual =
    actualTrials.reduce((sum, t) => sum + (t.enrollmentCount as number), 0) /
    actualTrials.length;
  const ratio = avgActual / benchmarkMedianSampleSize;
  const band = bandEnrollmentRatio(ratio);
  if (!band) {
    return noSignalRow(
      `Across ${actualTrials.length} trial(s) at this facility with reported ACTUAL enrollment, average ` +
        `enrollment was ${Math.round(ratio * 100)}% of the ${Math.round(benchmarkMedianSampleSize)}-patient ` +
        `median for completed trials in this indication — at or above the benchmark, no shortfall signal.`,
    );
  }
  const overall = RISK_MATRIX[band][band];

  return {
    "Risk ID": `R-ENROLLSHORT-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Enrollment",
    Description:
      `Across ${actualTrials.length} trial(s) at this facility for this indication with reported ` +
      `ACTUAL enrollment (${actualTrials.map((t) => t.nctId).join(", ")}), average enrollment was ` +
      `${Math.round(ratio * 100)}% of the ${Math.round(benchmarkMedianSampleSize)}-patient median for ` +
      `completed trials in this indication. This reflects the whole trial's enrollment, not this ` +
      `facility's individual contribution within a multi-site study — a real but indirect signal.`,
    Likelihood: band,
    Impact: band,
    "Overall Risk Rating": overall,
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan":
      "Confirm this facility's own per-site enrollment contribution directly with the sponsor before " +
      "relying on the whole-trial enrollment figure alone.",
    Owner: "Clinical Ops Manager",
    "Risk Score (Numeric)": riskScoreFor(overall),
    dataSource: "live",
  };
}

// Fixed convention, not a validated severity scale — each real, disclosed
// design attribute below adds one point: any blinding (SINGLE/DOUBLE/TRIPLE/
// QUADRUPLE masking), RANDOMIZED allocation, and a CROSSOVER/FACTORIAL
// intervention model. A simple open-label single-arm study scores 0.
function complexityScoreFor(t: FacilityTrialRecord): number {
  let score = 0;
  if (t.designMasking && t.designMasking !== "NONE") score += 1;
  if (t.designAllocation === "RANDOMIZED") score += 1;
  if (
    t.designInterventionModel === "CROSSOVER" ||
    t.designInterventionModel === "FACTORIAL"
  ) {
    score += 1;
  }
  return score;
}

/**
 * Real Protocol-Complexity record: derived from this facility's own trials'
 * disclosed design attributes for this indication (masking, allocation,
 * intervention model — all real, registry-disclosed fields, not a guess).
 * A blinded, randomized, crossover/factorial trial is inherently harder to
 * run correctly than an open-label single-arm one, independent of this
 * facility's own track record — this flags that complexity as its own
 * signal rather than folding it into Trial History.
 */
function protocolComplexityRiskRecordFrom(
  siteId: string,
  history: FacilityHistory | undefined,
): RiskRow {
  // No-signal row for this category — always returned instead of a skipped
  // category, so Protocol Complexity never silently disappears from a
  // site's risk register. Likelihood/Impact Low + Low renders as "No Risk"
  // (green) on the frontend.
  const noSignalRow = (reason: string): RiskRow => ({
    "Risk ID": `R-COMPLEXITY-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Protocol Complexity",
    Description: reason,
    Likelihood: "Low",
    Impact: "Low",
    "Overall Risk Rating": "Low",
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan": "No action needed — no elevated protocol-complexity signal found for this facility.",
    Owner: "Clinical Ops Manager",
    "Risk Score (Numeric)": riskScoreFor("Low"),
    dataSource: "live",
  });

  if (!history || history.trials.length === 0) {
    return noSignalRow(
      "No trial history on file at this facility to assess protocol complexity.",
    );
  }
  const withDesignData = history.trials.filter(
    (t) => t.designMasking || t.designAllocation || t.designInterventionModel,
  );
  if (withDesignData.length === 0) {
    return noSignalRow(
      "No disclosed design-attribute data (masking, allocation, intervention model) found for this facility's trials.",
    );
  }

  let worst: FacilityTrialRecord | null = null;
  let worstScore = -1;
  for (const t of withDesignData) {
    const score = complexityScoreFor(t);
    if (score > worstScore) {
      worstScore = score;
      worst = t;
    }
  }
  if (!worst || worstScore < 2) {
    return noSignalRow(
      `This facility's most complex trial design for this indication scores ${Math.max(worstScore, 0)}/3 ` +
        `by the fixed complexity convention (blinding, randomization, crossover/factorial design) — below ` +
        `the threshold that flags elevated protocol-complexity risk.`,
    );
  }

  const band: "Medium" | "High" = worstScore >= 3 ? "High" : "Medium";
  const overall = RISK_MATRIX[band][band];
  const traits = [
    worst.designMasking && worst.designMasking !== "NONE"
      ? `${worst.designMasking.toLowerCase()}-masked`
      : null,
    worst.designAllocation === "RANDOMIZED" ? "randomized" : null,
    worst.designInterventionModel === "CROSSOVER" ||
    worst.designInterventionModel === "FACTORIAL"
      ? worst.designInterventionModel.toLowerCase()
      : null,
  ].filter(Boolean);

  return {
    "Risk ID": `R-COMPLEXITY-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Protocol Complexity",
    Description:
      `Trial ${worst.nctId}${worst.briefTitle ? ` (${worst.briefTitle})` : ""} at this facility for ` +
      `this indication is ${traits.join(", ") || "a complex design"} — a complexity score of ` +
      `${worstScore}/3 by a fixed convention (blinding, randomization, and crossover/factorial design ` +
      `each add a point). Complex designs carry inherently higher operational and data-quality risk, ` +
      `independent of this facility's own track record.`,
    Likelihood: band,
    Impact: band,
    "Overall Risk Rating": overall,
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan":
      "Confirm the site's experience with this specific design pattern (blinding/randomization/" +
      "crossover) during site initiation; add extra monitoring visits if this is the site's first.",
    Owner: "Clinical Ops Manager",
    "Risk Score (Numeric)": riskScoreFor(overall),
    dataSource: "live",
  };
}

const REPORTING_DILIGENCE_STALE_DAYS = 365;
const REPORTING_DILIGENCE_SEVERELY_STALE_DAYS = 730;

/**
 * Real Reporting-Diligence record: NOT a substitute for a GCP compliance
 * inspection (no such public data exists for any facility) — this measures
 * something narrower but real and disclosed: how long ago the sponsor last
 * verified or updated this facility's trial record(s) on ClinicalTrials.gov
 * (StatusVerifiedDate / LastUpdatePostDate, both disclosed fields). A
 * facility whose trial records go a long time without being confirmed
 * accurate is a genuine, if indirect, disclosure-diligence signal.
 */
function reportingDiligenceRiskRecordFrom(
  siteId: string,
  history: FacilityHistory | undefined,
  facilityWideHistory?: FacilityHistory | null,
): RiskRow {
  // No-signal row for this category — always returned instead of a skipped
  // category, so Reporting Diligence never silently disappears from a
  // site's risk register. Likelihood/Impact Low + Low renders as "No Risk"
  // (green) on the frontend.
  const noSignalRow = (reason: string): RiskRow => ({
    "Risk ID": `R-REPORTDILIGENCE-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Reporting Diligence",
    Description: reason,
    Likelihood: "Low",
    Impact: "Low",
    "Overall Risk Rating": "Low",
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan": "No action needed — no reporting-diligence concern found for this facility.",
    Owner: "Regulatory Affairs Lead",
    "Risk Score (Numeric)": riskScoreFor("Low"),
    dataSource: "live",
  });

  const usingFacilityWide =
    !!facilityWideHistory && facilityWideHistory.trials.length > 0;
  const source = usingFacilityWide ? facilityWideHistory! : history;
  if (!source || source.trials.length === 0) {
    return noSignalRow(
      "No trial history on file at this facility to assess reporting diligence.",
    );
  }
  const scopeText = usingFacilityWide
    ? "across all indications on file at this facility"
    : "at this facility";

  const daysSince = (dateStr: string): number | null => {
    const then = new Date(dateStr);
    if (Number.isNaN(then.getTime())) return null;
    return (Date.now() - then.getTime()) / MS_PER_DAY;
  };

  const staleness: number[] = [];
  for (const t of source.trials) {
    const dateStr = t.statusVerifiedDate ?? t.lastUpdatePostDate;
    if (!dateStr) continue;
    const days = daysSince(dateStr);
    if (days !== null && days >= 0) staleness.push(days);
  }
  if (staleness.length === 0) {
    return noSignalRow(
      "No verification/update-date data disclosed for this facility's trial records.",
    );
  }

  const avgDays = staleness.reduce((a, b) => a + b, 0) / staleness.length;
  if (avgDays < REPORTING_DILIGENCE_STALE_DAYS) {
    return noSignalRow(
      `Across ${staleness.length} trial record(s) ${scopeText}, the sponsor last verified or updated ` +
        `records an average of ${Math.round(avgDays)} days ago — within the expected reporting window, ` +
        `no diligence concern.`,
    );
  }
  const band: "Medium" | "High" =
    avgDays >= REPORTING_DILIGENCE_SEVERELY_STALE_DAYS ? "High" : "Medium";
  const overall = RISK_MATRIX[band][band];

  return {
    "Risk ID": `R-REPORTDILIGENCE-${siteId}`,
    "Site ID": siteId,
    "Risk Category": "Reporting Diligence",
    Description:
      `Across ${staleness.length} trial record(s) ${scopeText}, the sponsor last verified or updated ` +
      `the ClinicalTrials.gov record an average of ${Math.round(avgDays)} days ago. This is a real, ` +
      `disclosed signal about record-keeping diligence — it is NOT the same as a GCP compliance ` +
      `inspection finding, which no public source discloses for any facility.`,
    Likelihood: band,
    Impact: band,
    "Overall Risk Rating": overall,
    "Date Identified": today(),
    Status: "Open",
    "Mitigation Plan":
      "Request a current status update directly from the sponsor/investigator before relying on " +
      "this facility's registry record as up to date.",
    Owner: "Regulatory Affairs Lead",
    "Risk Score (Numeric)": riskScoreFor(overall),
    dataSource: "live",
  };
}

export interface BuildLiveRiskRecordsParams {
  siteId: string;
  facilityName: string;
  city: string | null;
  country: string;
  indication: string;
  specialty: string;
  region: string;
  /** Real, per-facility count of nearby (same-city) actively-recruiting/not-yet-recruiting competing trial locations. */
  nearbyCompetingTrials: number;
  history?: FacilityHistory;
  /** Real, facility-wide (all-indications) trial history — a bigger sample for Trial History/Data Integrity/Reporting Diligence than the indication-scoped `history`. null/undefined falls back to `history` in each function. See getFacilityWideHistory's precision caveat in ctgov.client.ts. */
  facilityWideHistory?: FacilityHistory | null;
  /** Real completed-trial benchmark median sample size for this indication, reused from the LLM KPI estimate's benchmark fetch — feeds the Enrollment-shortfall signal. null if unavailable. */
  benchmarkMedianSampleSize?: number | null;
}

export async function buildLiveRiskRecords(
  params: BuildLiveRiskRecordsParams,
): Promise<{ risks: RiskRow[]; warning: string | null }> {
  const { risks: realRisks } = realRiskRecordsFrom(
    params.siteId,
    params.history,
    params.facilityWideHistory,
  );

  const competitiveRisk = competitiveRiskRecordFrom(
    params.siteId,
    params.nearbyCompetingTrials,
  );
  const dataIntegrityRisk = dataIntegrityRiskRecordFrom(
    params.siteId,
    params.history,
    params.facilityWideHistory,
  );
  const enrollmentShortfallRisk = enrollmentShortfallRiskRecordFrom(
    params.siteId,
    params.history,
    params.benchmarkMedianSampleSize ?? null,
  );
  const protocolComplexityRisk = protocolComplexityRiskRecordFrom(
    params.siteId,
    params.history,
  );
  const reportingDiligenceRisk = reportingDiligenceRiskRecordFrom(
    params.siteId,
    params.history,
    params.facilityWideHistory,
  );
  // Every one of these 5 categories is now always present for every
  // site — a category with no real signal comes back as a Low/Low "No
  // Risk" row (see each function's noSignalRow) rather than being skipped,
  // so the risk register never silently omits a category.
  const codeComputedRisks: RiskRow[] = [
    competitiveRisk,
    dataIntegrityRisk,
    enrollmentShortfallRisk,
    protocolComplexityRisk,
    reportingDiligenceRisk,
  ];

  const risks = [...realRisks, ...codeComputedRisks];
  let warning: string | null = null;

  if (risks.length === 0) {
    risks.push({
      "Risk ID": `R-NODATA-${params.siteId}`,
      "Site ID": params.siteId,
      "Risk Category": "Data Availability",
      Description:
        "No risk data is available for this live-sourced site — no terminated/withdrawn trial " +
        "history, no competing-trials signal, no overdue-results signal, no enrollment-shortfall " +
        "signal, no protocol-complexity signal, and no reporting-diligence signal were found for " +
        "this facility. This is NOT a confirmed low-risk assessment; it reflects an absence of data.",
      Likelihood: "Low",
      Impact: "Low",
      "Overall Risk Rating": "Low",
      "Date Identified": today(),
      Status: "Open",
      "Mitigation Plan": "Treat as unassessed; do not rely on this site's Low rating for a go/no-go decision.",
      Owner: "Clinical Ops Manager",
      "Risk Score (Numeric)": 1,
      dataSource: "live",
    });
    warning = `${params.facilityName}: no risk data available for this facility.`;
  }

  return { risks, warning };
}
