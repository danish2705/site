import { useEffect, useMemo, useState } from "react";
import type { RiskAssessmentRow } from "../../types";
import RiskRegisterTable from "./RiskRegisterTable";

function overallRiskTooltip(r: RiskAssessmentRow): string {
  const total = r.riskRecords.length;
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
              <span className="risk-accordion-badge-col">
                <span
                  className={`badge ${r.overallRisk.toLowerCase()}`}
                  title={overallRiskTooltip(r)}
                >
                  {r.overallRisk} Risk
                </span>
              </span>
              <span
                className="risk-accordion-counts"
                title={overallRiskTooltip(r)}
              >
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
