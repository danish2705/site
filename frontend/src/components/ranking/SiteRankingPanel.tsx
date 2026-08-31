import { Fragment, useEffect, useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import ScoreBreakdown from "./ScoreBreakdown";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import { fetchOutreachDraft } from "../../services/siteCombination.service";
import OutreachDraftModal from "../ui/OutreachDraftModal";
import { MailIcon } from "../ui/Icons";
import type { OutreachDraft, RankingRow } from "../../types";
import EmptyState from "../ui/EmptyState";

type LiveStatusFilter = "RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING";

const STATUS_OPTIONS: { value: LiveStatusFilter; label: string }[] = [
  { value: "RECRUITING", label: "Recruiting" },
  { value: "NOT_YET_RECRUITING", label: "Not Yet Recruiting" },
  { value: "ACTIVE_NOT_RECRUITING", label: "Active, Not Recruiting" },
];

function statusLabel(status: string | null): string {
  if (!status) return "Unknown";
  if (status.toUpperCase() === "NOT_YET_RECRUITING") {
    return "Recruiting not yet started";
  }
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function statusBand(
  status: string | null,
): "low" | "medium" | "high" | "info" | "no-data" {
  const s = (status ?? "").toUpperCase();
  if (s === "COMPLETED") return "info";
  if (s === "RECRUITING") return "low";
  if (s === "TERMINATED" || s === "WITHDRAWN" || s === "SUSPENDED") return "high";
  if (
    s === "ACTIVE_NOT_RECRUITING" ||
    s === "NOT_YET_RECRUITING" ||
    s === "ENROLLING_BY_INVITATION"
  ) {
    return "medium";
  }
  return "no-data";
}

export default function SiteRankingPanel() {
  const {
    form,
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
  const ranking = cached?.ranking ?? null;
  const pageLoading =
    !!pageCountry && !cached && (running || analyzing || prefetchingCountries.has(pageCountry));

  const filteredRanking = useMemo(() => {
    if (!ranking) return [];
    return ranking
      .filter((r) => (r.status ?? "").toUpperCase() === statusFilter)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [ranking, statusFilter]);

  const [openDraftSiteId, setOpenDraftSiteId] = useState<string | null>(null);
  const [draftLoadingSiteId, setDraftLoadingSiteId] = useState<string | null>(
    null,
  );
  const [drafts, setDrafts] = useState<Record<string, OutreachDraft>>({});
  const [draftError, setDraftError] = useState<string | null>(null);

  async function draftOutreachFor(row: RankingRow) {
    if (openDraftSiteId === row.siteId) {
      setOpenDraftSiteId(null);
      return;
    }
    if (drafts[row.siteId]) {
      setOpenDraftSiteId(row.siteId);
      return;
    }
    setDraftLoadingSiteId(row.siteId);
    setDraftError(null);
    try {
      const res = await fetchOutreachDraft({
        indication: form.indication,
        phase: form.phase || undefined,
        sites: [{ siteId: row.siteId, siteName: row.siteName }],
      });
      if (res.drafts[0]) {
        setDrafts((prev) => ({ ...prev, [row.siteId]: res.drafts[0] }));
        setOpenDraftSiteId(row.siteId);
      } else {
        setDraftError("Could not generate a draft for this site.");
      }
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setDraftLoadingSiteId(null);
    }
  }

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

  if (!ranking) {
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
            className="card-scroll-body ranking-scroll-body"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <StageLoader label="Loading site ranking…" />
          </div>
          <WizardNextLink />
        </div>
      );
    }
    return (
      <div className="card">
        {countryPicker && <div className="map-controls">{countryPicker}</div>}
        <EmptyState
          title={countryErrors[pageCountry] ? "No live sites found" : "No ranking yet"}
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
              {filteredRanking.length.toLocaleString()} of{" "}
              {ranking.length.toLocaleString()} site(s)
            </span>
          </div>
        </div>
      </div>
      {draftError && <p className="error-text">{draftError}</p>}
      <div className="card-scroll-body ranking-scroll-body">
        <div className="table-scroll">
          <table className="ranking-table">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Rank</th>
                <th className="ranking-site-col">Site</th>
                <th>Region</th>
                <th>Score</th>
                <th>Breakdown</th>
                <th>Protocol fit</th>
                <th>Risk</th>
                <th data-tooltip="Live ClinicalTrials.gov status for this site.">
                  Status
                </th>
                <th
                  style={{ textAlign: "center" }}
                  data-tooltip="Draft-only outreach text — no real contact email exists for these sites, and this app never actually sends anything."
                >
                  Outreach
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.length === 0 && (
                <tr>
                  <td colSpan={9} className="predict-placeholder">
                    No sites match the selected status filter.
                  </td>
                </tr>
              )}
              {filteredRanking.map((r) => (
                <Fragment key={r.siteId}>
                <tr>
                  <td>{r.rank}</td>
                  <td className="ranking-site-col">
                    {r.siteName}
                    <div className="site-id">{r.siteId}</div>
                  </td>
                  <td>{r.region}</td>
                  <td>
                    {r.score}/100
                    {r.confidence !== "High" && (
                      <div
                        className="score-confidence"
                        data-tooltip={r.caveats.join(" ")}
                      >
                        {r.confidence.toLowerCase()} confidence
                      </div>
                    )}
                  </td>
                  <td>
                    <ScoreBreakdown
                      components={r.components}
                      liveKpiFields={r.liveKpiFields}
                      liveKpiSourceNctId={r.liveKpiSourceNctId}
                      raceBreakdown={r.raceBreakdown}
                    />
                  </td>
                  <td>
                    {r.meetsRequirements ? (
                      <span className="badge low">Meets all</span>
                    ) : (
                      <span
                        className="badge medium"
                        data-tooltip={`Fails: ${r.failedCriteria.join(", ")}`}
                      >
                        {r.failedCriteria.length} unmet
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.riskLevel.toLowerCase()}`}>
                      {r.riskLevel}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusBand(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="predict-btn predict-btn-icon"
                      onClick={() => draftOutreachFor(r)}
                      disabled={draftLoadingSiteId === r.siteId}
                      data-tooltip={
                        draftLoadingSiteId === r.siteId
                          ? "Drafting…"
                          : openDraftSiteId === r.siteId
                            ? "Hide draft"
                            : drafts[r.siteId]
                              ? "View draft"
                              : "Draft email"
                      }
                    >
                      {draftLoadingSiteId === r.siteId ? (
                        <span className="spinner" />
                      ) : (
                        <MailIcon className="btn-icon" />
                      )}
                    </button>
                  </td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <WizardNextLink />

      {openDraftSiteId && drafts[openDraftSiteId] && (
        <OutreachDraftModal
          draft={drafts[openDraftSiteId]}
          onClose={() => setOpenDraftSiteId(null)}
        />
      )}
    </div>
  );
}
