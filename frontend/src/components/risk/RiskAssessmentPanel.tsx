import { useEffect, useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import RiskAssessmentAccordion from "./RiskAssessmentAccordion";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import EmptyState from "../ui/EmptyState";

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
    topRegion,
    selectedCountries,
    analysisCache,
    prefetchingCountries,
    countryErrors,
    analyzeForCountry,
  } = usePipeline();
  const [statusFilter, setStatusFilter] = useState<LiveStatusFilter>("RECRUITING");
  const [pageCountry, setPageCountry] = useState("");

  useEffect(() => {
    if (running) return;
    if (!topRegion) return;
    if (selectedCountries.length === 0) {
      if (pageCountry) setPageCountry("");
      return;
    }
    if (!selectedCountries.includes(pageCountry)) {
      setPageCountry(
        selectedCountries.includes(topRegion.country)
          ? topRegion.country
          : selectedCountries[0],
      );
    }
  }, [selectedCountries.join("|"), topRegion, running]);

  useEffect(() => {
    if (!pageCountry) return;
    if (analysisCache[pageCountry]) return;
    if (prefetchingCountries.has(pageCountry)) return;
    analyzeForCountry(pageCountry, { background: true });
  }, [pageCountry, analysisCache, prefetchingCountries]);

  const cached = pageCountry ? analysisCache[pageCountry] : undefined;
  const riskAssessment = cached?.riskAssessment ?? null;
  const recommendedSiteId = cached?.finalResult?.siteId;
  const pageLoading =
    !!pageCountry && !cached && (running || analyzing || prefetchingCountries.has(pageCountry));

  const filteredRows = useMemo(() => {
    if (!riskAssessment) return [];
    return riskAssessment.filter(
      (r) => (r.status ?? "").toUpperCase() === statusFilter,
    );
  }, [riskAssessment, statusFilter]);

  const countryPicker = selectedCountries.length > 0 && (
    <div className="predict-head-actions">
      <Select
        value={pageCountry}
        onChange={setPageCountry}
        placeholder="Select country to analyze…"
        options={selectedCountries.map((c) => ({ value: c, label: c }))}
      />
    </div>
  );

  if (!riskAssessment) {
    if (pageLoading) {
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
        {countryPicker && <div className="map-controls">{countryPicker}</div>}
        <EmptyState
          title={countryErrors[pageCountry] ? "No live sites found" : "No risk data yet"}
          detail={
            countryErrors[pageCountry]
              ? countryErrors[pageCountry]
              : selectedCountries.length > 0
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
          recommendedSiteId={recommendedSiteId}
        />
      </div>
      <WizardNextLink />
    </div>
  );
}
