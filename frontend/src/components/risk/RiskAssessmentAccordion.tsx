import { useEffect, useMemo, useState } from "react";
import type { RiskAssessmentRow } from "../../types";
import RiskRegisterTable from "./RiskRegisterTable";

function isAllNoRisk(r: RiskAssessmentRow): boolean {
  return (
    !r.riskDataUnavailable &&
    r.riskRecords.length > 0 &&
    r.riskRecords.every(
      (rec) => rec.likelihood === "Low" && rec.impact === "Low",
    )
  );
}

// Same status label/color treatment as the Ongoing Trials page (see
// CompetingTrialsPanel.tsx) — kept as a local copy rather than a shared
// import, matching this codebase's existing per-component convention.
function statusLabel(status: string | null): string {
  if (!status) return "Unknown";
  if (status.toUpperCase() === "NOT_YET_RECRUITING") {
    return "Recruiting not yet started";
  }
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function statusBand(
  status: string | null,
): "low" | "medium" | "high" | "info" | "no-data" {
  const s = (status ?? "").toUpperCase();
  if (s === "COMPLETED") return "info";
  if (s === "RECRUITING") return "low";
  if (s === "TERMINATED" || s === "WITHDRAWN" || s === "SUSPENDED") return "high";
  if (
    s === "ACTIVE_NOT_RECRUITING" ||
    s === "NOT_YET_RECRUITING" ||
    s === "ENROLLING_BY_INVITATION"
  ) {
    return "medium";
  }
  return "no-data";
}

function overallRiskTooltip(r: RiskAssessmentRow): string {
  const total = r.riskRecords.length;
  if (r.riskDataUnavailable) {
    return (
      "No risk data available for this site — no terminated/withdrawn trial history, no " +
      "competing-trials signal, no overdue-results signal, and no AI estimate could be produced. " +
      "This is NOT a confirmed low-risk assessment; treat it as unassessed."
    );
  }
  if (isAllNoRisk(r)) {
    return (
      `Overall: No Risk — all ${total} risk categor${total === 1 ? "y" : "ies"} assessed for this site ` +
      `came back Low likelihood and Low impact (no real signal found in any category).`
    );
  }
  if (r.overallRisk === "High") {
    return (
      `Overall: High — ${r.highRiskCount} of ${total} risk record(s) is rated High. ` +
      `A site is marked High overall if even one of its risk records is High, ` +
      `regardless of how many are Medium or Low.`
    );
  }
  if (r.overallRisk === "Medium") {
    return (
      `Overall: Medium — no High-rated records, but ${r.mediumRiskCount} of ${total} ` +
      `risk record(s) is rated Medium. A site is Medium overall if it has no High ` +
      `records but at least one Medium.`
    );
  }
  return (
    `Overall: Low — all ${total} risk record(s) for this site are rated Low ` +
    `(no High or Medium records).`
  );
}

export default function RiskAssessmentAccordion({
  rows,
  recommendedSiteId,
}: {
  rows: RiskAssessmentRow[];
  recommendedSiteId?: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    recommendedSiteId ?? null,
  );

  useEffect(() => {
    if (recommendedSiteId) setExpanded(recommendedSiteId);
  }, [recommendedSiteId]);

  const orderedRows = useMemo(() => {
    if (!expanded) return rows;
    const idx = rows.findIndex((r) => r.siteId === expanded);
    if (idx <= 0) return rows;
    const copy = [...rows];
    const [item] = copy.splice(idx, 1);
    copy.unshift(item);
    return copy;
  }, [rows, expanded]);

  if (orderedRows.length === 0) {
    return <p className="predict-placeholder">No sites match the selected status filter.</p>;
  }

  return (
    <div className="risk-accordion">
      {orderedRows.map((r) => {
        const isOpen = expanded === r.siteId;
        return (
          <div
            className={`risk-accordion-item ${isOpen ? "open" : ""}`}
            key={r.siteId}
          >
            <button
              type="button"
              className="risk-accordion-header"
              onClick={() => setExpanded(isOpen ? null : r.siteId)}
              aria-expanded={isOpen}
            >
              <span className="risk-accordion-site">
                <span className="risk-accordion-site-name">{r.siteName}</span>
                <span className="site-id">{r.siteId}</span>
              </span>
              <span className="risk-accordion-region">{r.region}</span>
              <span className="risk-accordion-status">
                <span
                  className={`badge ${statusBand(r.status)}`}
                  title="Live ClinicalTrials.gov status for this site."
                >
                  {statusLabel(r.status)}
                </span>
              </span>
              <span className="risk-accordion-badge-col">
                {r.riskDataUnavailable ? (
                  <span className="badge no-data" title={overallRiskTooltip(r)}>
                    Unassessed
                  </span>
                ) : isAllNoRisk(r) ? (
                  <span className="badge no-risk" title={overallRiskTooltip(r)}>
                    No Risk
                  </span>
                ) : (
                  <span
                    className={`badge ${r.overallRisk.toLowerCase()}`}
                    title={overallRiskTooltip(r)}
                  >
                    {r.overallRisk} Risk
                  </span>
                )}
              </span>
              <span
                className="risk-accordion-counts"
                title={overallRiskTooltip(r)}
              >
                {r.riskDataUnavailable
                  ? "unassessed"
                  : `${r.highRiskCount} high · ${r.mediumRiskCount} medium`}
              </span>
              <span className="risk-accordion-caret">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="risk-accordion-body">
                <RiskRegisterTable records={r.riskRecords} />
                {/* Static, non-scored note — Compliance is no longer generated as a
                    risk-register row (it had no real/disclosed data behind it and
                    could distort the Overall Risk badge with a fabricated rating).
                    This applies to every site equally, so it's shown here as plain
                    text rather than as a scored row. */}
                <p className="compliance-disclaimer">
                  Note: Compliance / GCP inspection history is not available from any
                  public source for these facilities. Verify current compliance status
                  directly with the CRO or site monitor before relying on this
                  assessment for a site activation decision.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
