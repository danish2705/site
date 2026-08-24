import { useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import { countriesFromRegionKeys } from "../../utils/region";

type LiveStatusFilter = "RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING";

const STATUS_OPTIONS: { value: LiveStatusFilter; label: string }[] = [
  { value: "RECRUITING", label: "Recruiting" },
  { value: "NOT_YET_RECRUITING", label: "Not Yet Recruiting" },
  { value: "ACTIVE_NOT_RECRUITING", label: "Active, Not Recruiting" },
];

export default function RiskAssessmentPanel() {
  const { riskAssessment, finalResult, running, analyzing, form, analyzeForCountry } =
    usePipeline();
  // Default to Recruiting per request — the strongest, currently-live signal.
  // Only these three statuses are offered; Completed/Terminated/Withdrawn/
  // Suspended/unknown-status sites aren't useful candidates here.
  const [statusFilter, setStatusFilter] = useState<LiveStatusFilter>("RECRUITING");
  // Country picker replaces the old "Send to Risk Assessment & Ranking"
  // button on Ongoing Trials: picking a country here fetches that country's
  // live sites and re-runs Stages 4-8 against them directly, right where
  // the results show up — see PipelineContext's analyzeForCountry.
  const selectedCountries = countriesFromRegionKeys(form.regions);
  const [analysisCountry, setAnalysisCountry] = useState("");

  function handleCountryChange(country: string) {
    setAnalysisCountry(country);
    if (country) analyzeForCountry(country);
  }

  const filteredRows = useMemo(() => {
    if (!riskAssessment) return [];
    return riskAssessment.filter(
      (r) => (r.status ?? "").toUpperCase() === statusFilter,
    );
  }, [riskAssessment, statusFilter]);

  const countryPicker = selectedCountries.length > 0 && (
    <label
      className="map-field"
      title="Pick a country to fetch its live sites and re-run Risk Register/Ranking against them."
    >
      <span>Country</span>
      <select
        value={analysisCountry}
        onChange={(e) => handleCountryChange(e.target.value)}
        disabled={analyzing}
      >
        <option value="" disabled>
          Select country to analyze…
        </option>
        {selectedCountries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  if (!riskAssessment) {
    if (running || analyzing) {
      return (
        <div className="card">
          <StageLoader label="Loading risk register…" />
        </div>
      );
    }
    // Stage 4-8 no longer auto-populate this from a fresh CT.gov fetch of
    // their own — they only run once the user picks a country here (see
    // PipelineContext's analyzeForCountry) or sends a reviewed site list
    // from Ongoing Trials (analyzeOngoingTrialSites).
    return (
      <div className="card">
        {countryPicker && <div className="map-controls">{countryPicker}</div>}
        <p className="predict-placeholder">
          {selectedCountries.length > 0
            ? "No risk data yet — pick a country above to fetch its live sites and run Risk Register/Ranking."
            : 'No risk data yet — pick a region/country in Step 1, then select a country above to populate this.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-actions" style={{ marginLeft: "auto" }}>
            {countryPicker}
            <select
              className={countryPicker ? "map-search-btn" : undefined}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as LiveStatusFilter)
              }
              title="Filter sites by trial status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span
              className={`map-table-count ${countryPicker ? "map-search-btn" : ""}`}
            >
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
