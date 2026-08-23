import { useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

// Groups the same real, disclosed statuses the Ongoing Trials page groups
// (see CompetingTrialsPanel.tsx's statusGroupFor) — kept as a local copy per
// this codebase's existing per-component convention.
function statusGroupFor(status: string | null): "completed" | "active" | "other" {
  const s = (status ?? "").toUpperCase();
  if (s === "COMPLETED") return "completed";
  if (
    s === "RECRUITING" ||
    s === "ACTIVE_NOT_RECRUITING" ||
    s === "NOT_YET_RECRUITING" ||
    s === "ENROLLING_BY_INVITATION"
  ) {
    return "active";
  }
  return "other";
}

export default function RiskAssessmentPanel() {
  const { riskAssessment, finalResult, running } = usePipeline();
  const [statusFilter, setStatusFilter] = useState<
    "all" | "completed" | "active" | "other"
  >("all");

  const filteredRows = useMemo(() => {
    if (!riskAssessment) return [];
    if (statusFilter === "all") return riskAssessment;
    return riskAssessment.filter(
      (r) => statusGroupFor(r.status) === statusFilter,
    );
  }, [riskAssessment, statusFilter]);

  if (!riskAssessment) {
    if (running) {
      return (
        <div className="card">
          <StageLoader label="Loading risk register…" />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="tag">Stage 6 Output</span>
          </div>
          <div className="predict-head-actions">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "completed" | "active" | "other",
                )
              }
              title="Filter sites by trial status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active (Recruiting, etc.)</option>
              <option value="completed">Completed</option>
              <option value="other">
                Other (Terminated/Withdrawn/Suspended/Unknown)
              </option>
            </select>
            <span className="map-table-count">
              {filteredRows.length.toLocaleString()} of{" "}
              {riskAssessment.length.toLocaleString()} site(s)
            </span>
          </div>
        </div>
      </div>
      <div className="card-scroll-body">
        <RiskAssessmentAccordion
          rows={filteredRows}
          recommendedSiteId={finalResult?.siteId}
        />
      </div>
      <WizardNextLink />
    </div>
  );
}
