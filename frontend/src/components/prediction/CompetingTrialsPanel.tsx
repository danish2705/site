import { useEffect, useMemo, useState } from "react";
import type { LiveTrialLandscapeResponse } from "../../types";
import { fetchLiveTrialLandscape } from "../../services/liveTrials.service";
import { usePipeline } from "../../hooks/usePipeline";
import { countryMatches } from "../../utils/region";
import WizardNextLink from "../ui/WizardNextLink";
import TableSkeleton from "../ui/TableSkeleton";
import Select from "../ui/Select";
import Tooltip from "../ui/Tooltip";

export default function CompetingTrialsPanel({
  indication,
  selectedCountries = [],
  ageGroups = [],
}: {
  indication: string;
  selectedCountries?: string[];
  ageGroups?: string[];
}) {
  const [country, setCountry] = useState("");
  const [data, setData] = useState<LiveTrialLandscapeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  type StatusFilter =
    | "all"
    | "recruiting"
    | "not_yet_recruiting"
    | "active_not_recruiting"
    | "enrolling_by_invitation"
    | "completed"
    | "other";
  const { setOngoingTrialSites, nctScope, nctScopeFacilities } = usePipeline();
  // Default to Recruiting per request — EXCEPT for an NCT-scoped analysis
  // (auditing one specific trial's own disclosed site(s), which may not be
  // "live" at all), which defaults to "all" instead so its site isn't
  // hidden just because it isn't currently recruiting.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() =>
    nctScope ? "all" : "recruiting",
  );

  useEffect(() => {
    if (selectedCountries.length === 0) {
      if (country) setCountry("");
    } else if (!selectedCountries.includes(country)) {
      setCountry(selectedCountries[0]);
    }
  }, [selectedCountries]);

  const countryResolved = selectedCountries.length === 0 || country !== "";

  async function runSearch(forCountry: string) {
    if (!indication) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLiveTrialLandscape({
        indication,
        country: forCountry || undefined,
        ageGroups,
      });
      setData(res);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Scoped mode: this trial's own disclosed sites (nctScopeFacilities) are
    // already known — no need for (and no reason to run) a fresh broad
    // ClinicalTrials.gov search by indication, which is exactly what used to
    // surface OTHER trials' NCT codes here.
    if (nctScope) return;
    if (!indication || !countryResolved) return;
    setData(null);
    runSearch(country);
  }, [indication, country, countryResolved, nctScope]);

  // Scoped mode sources rows directly from this one trial's own disclosed
  // site list (already fetched by the landing page's NCT lookup) instead of
  // `data` (a broad, indication-wide search this panel deliberately skips
  // above). Every row here shares the same nctId — no "why am I seeing
  // other NCT codes" confusion, and no recency filter either: these are the
  // trial's own current locations, not a staleness heuristic for excluding
  // OTHER trials.
  const facilities = nctScope
    ? nctScopeFacilities.filter((f) => countryMatches(f.country, country))
    : (data?.facilities ?? []);

  const RECENT_YEARS = 3;
  const recentFacilities = useMemo(() => {
    if (nctScope) return facilities;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RECENT_YEARS);
    return facilities.filter((f) => {
      if (!f.lastUpdatePostDate) return false;
      const d = new Date(f.lastUpdatePostDate);
      return !isNaN(d.getTime()) && d >= cutoff;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities, nctScope]);

  useEffect(() => {
    if (recentFacilities.length > 0) setOngoingTrialSites(recentFacilities);
  }, [recentFacilities]);

  function statusGroupFor(
    status: string | null,
  ):
    | "completed"
    | "recruiting"
    | "not_yet_recruiting"
    | "active_not_recruiting"
    | "enrolling_by_invitation"
    | "other" {
    const s = (status ?? "").toUpperCase();
    if (s === "COMPLETED") return "completed";
    if (s === "RECRUITING") return "recruiting";
    if (s === "NOT_YET_RECRUITING") return "not_yet_recruiting";
    if (s === "ACTIVE_NOT_RECRUITING") return "active_not_recruiting";
    if (s === "ENROLLING_BY_INVITATION") return "enrolling_by_invitation";
    return "other";
  }

  const LIVE_STATUS_GROUPS = [
    "recruiting",
    "not_yet_recruiting",
    "active_not_recruiting",
    "enrolling_by_invitation",
  ];

  const activeCompetingSites = useMemo(
    () =>
      recentFacilities.filter((f) =>
        LIVE_STATUS_GROUPS.includes(statusGroupFor(f.status)),
      ).length,
    [recentFacilities],
  );

  const statusFiltered =
    statusFilter === "all"
      ? recentFacilities
      : recentFacilities.filter((f) => statusGroupFor(f.status) === statusFilter);

  const filtered = search.trim()
    ? statusFiltered.filter((f) =>
        [f.nctId, f.briefTitle, f.facility, f.city, f.state, f.country]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(search.trim().toLowerCase())),
      )
    : statusFiltered;

  function statusLabel(status: string | null): string {
    if (!status) return "Unknown";
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

  function statusFilterDotColor(filter: StatusFilter): string {
    switch (filter) {
      case "recruiting":
        return "var(--low)";
      case "not_yet_recruiting":
      case "active_not_recruiting":
      case "enrolling_by_invitation":
        return "var(--med)";
      case "completed":
        return "var(--info)";
      case "other":
        return "var(--high)";
      default:
        return "var(--sub)";
    }
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          {}
          <div className="predict-head-actions">
            {selectedCountries.length > 0 && (
              <Select
                value={country}
                onChange={setCountry}
                disabled={loading}
                options={selectedCountries.map((c) => ({ value: c, label: c }))}
              />
            )}
            {loading && <span className="spinner" />}
          </div>
        </div>
      </div>

      <div className="card-scroll-body">
      {error && <p className="error-text">{error}</p>}

      {loading && !data && <TableSkeleton columns={5} rows={7} label="Loading ongoing trials…" />}

      {data?.warnings.map((w, i) => (
        <p key={i} className="warning-text">
          {w}
        </p>
      ))}

      {(nctScope || data) && (
        <>
          <div className="ct-toolbar">
            <div className="ct-stat-item ct-stat-item--inline">
              <div className="ct-stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <div className="ct-stat-text">
                <div className="k">Active / Competing Sites</div>
                <div className="v">{activeCompetingSites.toLocaleString()}</div>
              </div>
            </div>
            <div className="ct-divider" />
            <div className="ct-stat-item ct-stat-item--inline">
              <div className="ct-stat-icon green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <div className="ct-stat-text">
                <div className="k">
                  {nctScope
                    ? "Disclosed Site Rows"
                    : `Trial / Site Rows Found (Last ${RECENT_YEARS} yrs)`}
                </div>
                <div className="v">{recentFacilities.length.toLocaleString()}</div>
              </div>
            </div>
            <div className="ct-divider" />
            <div className="ct-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                placeholder="Search trial, site, city, or country…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="ct-divider" />
            <div className="ct-status-wrap">
              <span
                className="ct-status-dot"
                style={{ background: statusFilterDotColor(statusFilter) }}
              />
              <Select
                className="ct-status-select"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                data-tooltip="Filter rows by trial status"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "recruiting", label: "Recruiting" },
                  { value: "not_yet_recruiting", label: "Not Yet Recruiting" },
                  { value: "active_not_recruiting", label: "Active, Not Recruiting" },
                  { value: "completed", label: "Completed" },
                ]}
              />
            </div>
            <div className="ct-divider" />
            <span className="ct-count-chip">
              {filtered.length.toLocaleString()} of{" "}
              {recentFacilities.length.toLocaleString()} row(s)
            </span>
          </div>

          <div className="table-scroll">
            <table className="competing-trials-table">
              {}
              <colgroup>
                <col style={{ width: "32%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "19%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Trial</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Site</th>
                  <th>Disease</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => {
                  const location = [f.city, f.state, f.country]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr key={`${f.nctId}-${i}`}>
                      <Tooltip
                        as="td"
                        text={f.briefTitle ?? undefined}
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <a
                          href={`https://clinicaltrials.gov/study/${f.nctId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {f.briefTitle || f.nctId || "—"}
                        </a>
                        {f.briefTitle && f.nctId && (
                          <div className="site-id">{f.nctId}</div>
                        )}
                      </Tooltip>
                      <td>
                        <span className={`badge ${statusBand(f.status)}`}>
                          {statusLabel(f.status)}
                        </span>
                      </td>
                      <td>{f.lastUpdatePostDate || "—"}</td>
                      <td
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.facility || location || "—"}
                      </td>
                      <td
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {indication}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="predict-placeholder">
                      {facilities.length === 0
                        ? nctScope
                          ? `${nctScope} doesn't disclose any sites in ${country || "this selection"}.`
                          : "No trials found on ClinicalTrials.gov for this indication."
                        : search.trim()
                          ? `No rows match "${search}".`
                          : "No rows match the selected status filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
      <WizardNextLink />
    </div>
  );
}
