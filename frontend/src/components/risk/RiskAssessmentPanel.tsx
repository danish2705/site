import { useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import EmptyState from "../ui/EmptyState";
import { allConfiguredCountries } from "../../utils/region";

type LiveStatusFilter = "RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING";

const STATUS_OPTIONS: { value: LiveStatusFilter; label: string }[] = [
  { value: "RECRUITING", label: "Recruiting" },
  { value: "NOT_YET_RECRUITING", label: "Not Yet Recruiting" },
  { value: "ACTIVE_NOT_RECRUITING", label: "Active, Not Recruiting" },
];

export default function RiskAssessmentPanel() {
  const {
    running,
    analyzing,
    selectedCountries,
    regionOptions,
    prefetchingCountries,
    countryErrors,
    // Shared across Risk Register/Ranking/Final Recommendation — picking a
    // country here keeps the other two pages in sync, and (crucially) this
    // state lives in the provider, not in this component, so navigating away
    // from this tab and back does NOT reset it. Each panel previously kept
    // its own local `pageCountry` state, which reset to "" on every remount
    // and briefly rendered the empty/loading state again even for a country
    // that was already fully analyzed — that remount-reset was the flicker.
    analysisCountry: pageCountry,
    setAnalysisCountry: setPageCountry,
    riskAssessment,
    finalResult,
  } = usePipeline();
  // When the trial form has no region/country pre-selected (the NCT-lookup
  // flow deliberately leaves this empty to search every region globally),
  // fall back to every country this app is configured to search at all,
  // rather than leaving the picker with nothing to show.
  const countryOptions =
    selectedCountries.length > 0
      ? selectedCountries
      : allConfiguredCountries(regionOptions);
  // Default to Recruiting per request — the strongest, currently-live signal.
  // Only these three statuses are offered; Completed/Terminated/Withdrawn/
  // Suspended/unknown-status sites aren't useful candidates here.
  const [statusFilter, setStatusFilter] = useState<LiveStatusFilter>("RECRUITING");

  const recommendedSiteId = finalResult?.siteId;
  const pageLoading =
    !!pageCountry &&
    !riskAssessment &&
    (running || analyzing || prefetchingCountries.has(pageCountry));

  const filteredRows = useMemo(() => {
    if (!riskAssessment) return [];
    return riskAssessment.filter(
      (r) => (r.status ?? "").toUpperCase() === statusFilter,
    );
  }, [riskAssessment, statusFilter]);

  const countryPicker = countryOptions.length > 0 && (
    <div className="predict-head-actions">
      <Select
        className="country-select-wide"
        value={pageCountry}
        onChange={setPageCountry}
        placeholder="Select country to analyze…"
        options={countryOptions.map((c) => ({ value: c, label: c }))}
      />
    </div>
  );

  if (!riskAssessment) {
    if (pageLoading) {
      return (
        <div className="card">
          <div className="predict-head">
            <div className="predict-head-top map-controls map-controls--flush">
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
              </div>
            </div>
          </div>
          <div
            className="card-scroll-body"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <StageLoader label="Loading risk register…" />
          </div>
          <WizardNextLink />
        </div>
      );
    }
    return (
      <div className="card">
        {countryPicker && (
          <div className="map-controls map-controls--flush">{countryPicker}</div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 200,
          }}
        >
          <EmptyState
            title={countryErrors[pageCountry] ? "No live sites found" : "No risk data yet"}
            detail={
              countryErrors[pageCountry]
                ? countryErrors[pageCountry]
                : countryOptions.length > 0
                  ? "Pick a country above to fetch its live sites and run Risk Register/Ranking."
                  : "Pick a region/country in Step 1, then select a country above to populate this."
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top map-controls map-controls--flush">
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
          recommendedSiteId={recommendedSiteId}
        />
      </div>
      <WizardNextLink />
    </div>
  );
}