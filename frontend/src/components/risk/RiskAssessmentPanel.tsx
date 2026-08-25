import { useEffect, useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import EmptyState from "../ui/EmptyState";
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

  // Default the picker to the first selected country (same convention as
  // Ongoing Trials' country picker) so it shows an actual country instead
  // of sitting on the "Select country to analyze…" placeholder — this is
  // purely a display default, it does not call analyzeForCountry itself.
  useEffect(() => {
    if (selectedCountries.length === 0) {
      if (analysisCountry) setAnalysisCountry("");
    } else if (!selectedCountries.includes(analysisCountry)) {
      setAnalysisCountry(selectedCountries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries.join("|")]);

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
    <div
      className="predict-head-actions"
      data-tooltip="Pick a country to fetch its live sites and re-run Risk Register/Ranking against them."
    >
      <Select
        value={analysisCountry}
        onChange={handleCountryChange}
        disabled={analyzing}
        placeholder="Select country to analyze…"
        options={selectedCountries.map((c) => ({ value: c, label: c }))}
      />
    </div>
  );

  if (!riskAssessment) {
    if (running || analyzing) {
      return (
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
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
        <EmptyState
          title="No risk data yet"
          detail={
            selectedCountries.length > 0
              ? "Pick a country above to fetch its live sites and run Risk Register/Ranking."
              : "Pick a region/country in Step 1, then select a country above to populate this."
          }
        />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          {countryPicker}
          <div className="predict-head-actions" style={{ marginLeft: "auto" }}>
            <Select
              className="status-filter-select"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as LiveStatusFilter)}
              data-tooltip="Filter sites by trial status"
              options={STATUS_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
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
