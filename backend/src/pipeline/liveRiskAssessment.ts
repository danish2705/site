/**
 * Builds risk-register rows for a live, ClinicalTrials.gov-sourced site.
 *
 * Two distinct sources, kept explicitly separate and tagged differently:
 *  - REAL signal: trial-status history at that exact facility (terminated /
 *    withdrawn / suspended trials, with the sponsor-disclosed reason where
 *    available). This is a disclosed fact, not a guess — dataSource: "live".
 *  - LLM-ESTIMATED signal: categories nobody discloses publicly at all
 *    (Compliance, Data Integrity, Staff Turnover, Competitive) — dataSource:
 *    "llm-estimated", generated only for categories the real signal didn't
 *    already cover.
 *
 * If neither source produces anything (no history + LLM unavailable/fails),
 * an explicit single placeholder row is returned rather than an empty list,
 * so "no risk data" is visibly different from "assessed and found low-risk."
 */
import type { RiskRow } from "../types.js";
import type { FacilityHistory } from "../services/ctgov.client.js";
import { estimateSiteRisks, llmStatus } from "../llm/client.js";

const TERMINAL_STATUSES = new Set(["TERMINATED", "WITHDRAWN", "SUSPENDED"]);

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

function realRiskRecordsFrom(
  siteId: string,
  history: FacilityHistory | undefined,
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

  const risks: RiskRow[] = terminal.map((t) => {
    const impact: "High" | "Medium" =
      t.overallStatus === "TERMINATED" ? "High" : "Medium";
    const category = categorizeWhyStopped(t.whyStopped);
    return {
      "Risk ID": `R-LIVE-${t.nctId || siteId}`,
      "Site ID": siteId,
      "Risk Category": category,
      Description:
        `Trial ${t.nctId}${t.briefTitle ? ` (${t.briefTitle})` : ""} at this facility was ` +
        `${t.overallStatus}${t.whyStopped ? `: ${t.whyStopped}` : " — no reason disclosed"}.`,
      Likelihood: "Medium",
      Impact: impact,
      "Overall Risk Rating": impact,
      "Date Identified": today(),
      Status: "Open",
      "Mitigation Plan":
        "Confirm root cause with the site directly before allocating enrollment; " +
        "request updated staffing/enrollment plan if history repeats.",
      Owner: "Clinical Ops Manager",
      "Risk Score (Numeric)": riskScoreFor(impact),
      dataSource: "live",
    };
  });

  const summary =
    `${terminal.length} of ${history.trials.length} prior trial(s) at this facility were ` +
    `terminated/withdrawn/suspended (reasons: ${terminal
      .map((t) => t.whyStopped || "undisclosed")
      .join("; ")}).`;

  return { risks, summary };
}

export interface BuildLiveRiskRecordsParams {
  siteId: string;
  facilityName: string;
  city: string | null;
  country: string;
  indication: string;
  specialty: string;
  region: string;
  history?: FacilityHistory;
}

export async function buildLiveRiskRecords(
  params: BuildLiveRiskRecordsParams,
): Promise<{ risks: RiskRow[]; warning: string | null }> {
  const { risks: realRisks, summary } = realRiskRecordsFrom(
    params.siteId,
    params.history,
  );

  const { configured: llmConfigured } = llmStatus();
  let estimatedRisks: RiskRow[] = [];
  let warning: string | null = null;

  if (llmConfigured) {
    try {
      const estimate = await estimateSiteRisks({
        facilityName: params.facilityName,
        city: params.city,
        country: params.country,
        indication: params.indication,
        specialty: params.specialty,
        region: params.region,
        realHistorySummary: summary,
      });
      estimatedRisks = estimate.records.map((r, i) => ({
        "Risk ID": `R-EST-${params.siteId}-${i + 1}`,
        "Site ID": params.siteId,
        "Risk Category": r.category,
        Description: r.description,
        Likelihood: r.likelihood,
        Impact: r.impact,
        "Overall Risk Rating": r.overallRisk,
        "Date Identified": today(),
        Status: "Open",
        "Mitigation Plan": r.mitigationPlan,
        Owner: r.owner,
        "Risk Score (Numeric)": riskScoreFor(r.overallRisk),
        dataSource: "llm-estimated",
      }));
    } catch (err) {
      warning = `${params.facilityName}: LLM risk estimate failed (${(err as Error).message}).`;
    }
  } else {
    warning = `${params.facilityName}: LLM not configured — no estimated risk entries for Compliance/Data Integrity/Staff Turnover/Competitive categories.`;
  }

  const risks = [...realRisks, ...estimatedRisks];

  if (risks.length === 0) {
    risks.push({
      "Risk ID": `R-NODATA-${params.siteId}`,
      "Site ID": params.siteId,
      "Risk Category": "Data Availability",
      Description:
        "No risk data is available for this live-sourced site — no terminated/withdrawn " +
        "trial history was found at this facility, and no LLM estimate could be produced. " +
        "This is NOT a confirmed low-risk assessment; it reflects an absence of data.",
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
    warning = warning ?? `${params.facilityName}: no risk data available (real or estimated).`;
  }

  return { risks, warning };
}
