import { useMemo } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

// Only show sites that are currently Recruiting or Active (Not Recruiting) —
// Completed/Terminated/Withdrawn/Suspended/unknown-status sites aren't useful
// candidates here, and there's no longer a status dropdown for the user to
// toggle this themselves (removed per request — the filter wasn't needed).
function isLiveActiveStatus(status: string | null): boolean {
  const s = (status ?? "").toUpperCase();
  return s === "RECRUITING" || s === "ACTIVE_NOT_RECRUITING";
}

export default function RiskAssessmentPanel() {
  const { riskAssessment, finalResult, running } = usePipeline();

  const filteredRows = useMemo(() => {
    if (!riskAssessment) return [];
    return riskAssessment.filter((r) => isLiveActiveStatus(r.status));
  }, [riskAssessment]);

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
