import { usePipeline } from "../context/PipelineContext";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "./WizardNextLink";

export default function RiskAssessmentPanel() {
  const { riskAssessment, finalResult } = usePipeline();
  if (!riskAssessment) return null;

  return (
    <div className="card">
      <span className="tag">Stage 6 Output</span>
      <p className="section-hint">
        Every candidate site's risk register, as individual records — expand
        a site to see them. Click a site to expand/collapse.
      </p>
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
