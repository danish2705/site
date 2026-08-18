import { useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import SiteMapView from "../prediction/SiteMapView";
import { countriesFromRegionKeys } from "../../utils/region";

export default function RiskAssessmentPanel() {
  const { riskAssessment, finalResult, form } = usePipeline();
  const [activeTab, setActiveTab] = useState<"risk" | "map">("risk");
  if (!riskAssessment) return null;

  return (
    <div className="card">
      <div className="predict-tabs">
        <button
          type="button"
          className={`predict-tab ${activeTab === "risk" ? "active" : ""}`}
          onClick={() => setActiveTab("risk")}
        >
          Risk Register
        </button>
        <button
          type="button"
          className={`predict-tab ${activeTab === "map" ? "active" : ""}`}
          onClick={() => setActiveTab("map")}
        >
          Site Map (Global)
        </button>
      </div>

      {activeTab === "map" ? (
        <SiteMapView
          indication={form.indication}
          selectedCountries={countriesFromRegionKeys(form.regions)}
        />
      ) : (
        <>
          <span className="tag">Stage 6 Output</span>
          <p className="section-hint">
            Every candidate site's risk register, as individual records — expand a
            site to see them. Click a site to expand/collapse.
          </p>
          <div className="card-scroll-body">
            <RiskAssessmentAccordion
              rows={riskAssessment}
              recommendedSiteId={finalResult?.siteId}
            />
          </div>
        </>
      )}
      <WizardNextLink />
    </div>
  );
}
