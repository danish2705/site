import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

export default function RiskAssessmentPanel() {
  const { riskAssessment, finalResult, running } = usePipeline();

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
      <span className="tag">Stage 6 Output</span>
      <div className="card-scroll-body">
        <RiskAssessmentAccordion
          rows={riskAssessment}
          recommendedSiteId={finalResult?.siteId}
        />
      </div>
      <WizardNextLink />
    </div>
  );
}
