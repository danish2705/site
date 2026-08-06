import { useEffect, useState } from "react";
import type { RiskAssessmentRow } from "../types";
import RiskRegisterTable from "./RiskRegisterTable";

// Stage 6 output: an accordion of every candidate site (before ranking
// narrows to the top 10), each expandable to its full risk register.
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

  // The recommended site is only known once Stage 8 finishes, well after
  // this accordion first mounts from Stage 6's output — auto-expand it the
  // moment it becomes available instead of only honoring it at mount time.
  useEffect(() => {
    if (recommendedSiteId) setExpanded(recommendedSiteId);
  }, [recommendedSiteId]);

  return (
    <div className="risk-accordion">
      {rows.map((r) => {
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
              <span className="risk-accordion-badge-col">
                <span className={`badge ${r.overallRisk.toLowerCase()}`}>
                  {r.overallRisk}
                </span>
              </span>
              <span className="risk-accordion-counts">
                {r.highRiskCount} high · {r.mediumRiskCount} medium
              </span>
              <span className="risk-accordion-caret">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="risk-accordion-body">
                <RiskRegisterTable records={r.riskRecords} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
