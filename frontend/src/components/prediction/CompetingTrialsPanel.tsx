import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveTrialLandscapeResponse } from "../../types";
import { fetchLiveTrialLandscape } from "../../services/liveTrials.service";
import { usePipeline } from "../../hooks/usePipeline";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

export default function CompetingTrialsPanel({
  indication,
  selectedCountries = [],
  ageGroups = [],
}: {
  indication: string;
  /** Countries pulled from the trial form's already-selected regions — same convention as SiteMapView. Empty = only "All countries" is offered. */
  selectedCountries?: string[];
  /** The trial form's selected Age Group(s) — same real StdAge eligibility filter Risk Register/Ranking/Site Map already apply. Applied here too so a trial that isn't actually age-eligible for this run doesn't show up as "live competition." Empty = all ages, no filtering. */
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("recruiting");
  const { setOngoingTrialSites, analyzeOngoingTrialSites, analyzing } =
    usePipeline();

  useEffect(() => {
    if (selectedCountries.length === 0) {
      if (country) setCountry("");
    } else if (!selectedCountries.includes(country)) {
      setCountry(selectedCountries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries]);

  const countryResolved = selectedCountries.length === 0 || country !== "";
  const autoSearchedRef = useRef(false);

  async function runSearch() {
    if (!indication) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLiveTrialLandscape({
        indication,
        country: country || undefined,
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
    if (autoSearchedRef.current || !indication || !countryResolved) return;
    autoSearchedRef.current = true;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indication, countryResolved]);

  const facilities = data?.facilities ?? [];

  // Requirement: only show trials updated within the last RECENT_YEARS years
  // — the raw ClinicalTrials.gov result includes everything on record for
  // this indication going back decades, which is too much history to be
  // useful here. Rows with no parseable "Last Updated" date are excluded
  // rather than assumed-recent, since we have no evidence either way.
  const RECENT_YEARS = 3;
  const recentFacilities = useMemo(() => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RECENT_YEARS);
    return facilities.filter((f) => {
      if (!f.lastUpdatePostDate) return false;
      const d = new Date(f.lastUpdatePostDate);
      return !isNaN(d.getTime()) && d >= cutoff;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilities]);

  // Hands this exact, already-reviewed live site list to PipelineContext so
  // "Send to Risk Assessment & Ranking" below (and analyzeOngoingTrialSites)
  // analyzes THESE rows — not a second, independent ClinicalTrials.gov
  // fetch. Uses the full 3-year-recency window (not the transient
  // statusFilter view below), since the status dropdown is just a lens for
  // browsing, not a hard exclusion for what counts as a candidate site.
  useEffect(() => {
    if (recentFacilities.length > 0) setOngoingTrialSites(recentFacilities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentFacilities]);

  // Groups each real, disclosed OverallStatus value into the buckets the
  // Status filter offers. Recruiting / Not Yet Recruiting / Active Not
  // Recruiting / Enrolling By Invitation are kept as four SEPARATE buckets
  // (rather than one combined "active" bucket) so the filter can show each
  // status on its own — these are meaningfully different competitive
  // signals (currently enrolling vs. about to vs. no longer taking new
  // patients), not interchangeable. "Other" (not silently hidden — always
  // selectable) covers TERMINATED/WITHDRAWN/SUSPENDED and any
  // unrecognized/null status.
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

  // KPI tile: count of individual SITES (trial/site rows) currently in any
  // live/competing status, not distinct trials — a single multi-site trial
  // (one NCT ID) can occupy several sites, and each of those is separate
  // competition for patients at that site. Derived from recentFacilities
  // (already deduped to the same last-RECENT_YEARS window as the table)
  // rather than the backend's activeCompetingTrials (a distinct-trial count
  // from ClinicalTrials.gov's countTotal), so the KPI always matches what's
  // actually in the table below it.
  const activeCompetingSites = useMemo(
    () =>
      recentFacilities.filter((f) =>
        LIVE_STATUS_GROUPS.includes(statusGroupFor(f.status)),
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Colors each trial's status the same way the Risk Register colors its
  // risk levels — reusing the same .badge/--low/--med/--high/--no-data
  // classes/tokens, instead of the flat neutral .chip this table used
  // before, so a status carries the same at-a-glance visual weight here as
  // a risk rating does there. RECRUITING reads as "healthy" (green);
  // COMPLETED gets its own distinct blue ("info") rather than sharing
  // green with Recruiting, since "still enrolling" and "already finished"
  // are different states worth telling apart at a glance;
  // ACTIVE_NOT_RECRUITING/NOT_YET_RECRUITING/ENROLLING_BY_INVITATION read as
  // an in-between/caution state (amber); the stopped-for-cause statuses
  // (TERMINATED/WITHDRAWN/SUSPENDED) as high (red); anything else
  // (null/unrecognized) falls back to the same grey "no-data" treatment
  // used for an unassessed risk record.
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

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="predict-title">Ongoing Trials</span>
          </div>
          <div className="predict-head-actions">
            {selectedCountries.length > 0 && (
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">All selected countries</option>
                {selectedCountries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="predict-btn"
              onClick={runSearch}
              disabled={loading || !indication}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Searching…
                </>
              ) : (
                "Search"
              )}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={analyzeOngoingTrialSites}
              disabled={analyzing || recentFacilities.length === 0}
              title="Runs Risk Register/Ranking against exactly the sites currently listed below"
            >
              {analyzing ? (
                <>
                  <span className="spinner" /> Analyzing…
                </>
              ) : (
                "Send to Risk Assessment & Ranking →"
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="card-scroll-body">
      {error && <p className="error-text">{error}</p>}

      {loading && !data && <StageLoader label="Loading ongoing trials…" />}

      {data?.warnings.map((w, i) => (
        <p key={i} className="warning-text">
          {w}
        </p>
      ))}

      {data && (
        <>
          <div className="final-grid" style={{ marginTop: 4, marginBottom: 12 }}>
            <div className="item">
              <div className="k">Active / competing sites</div>
              <div className="v">{activeCompetingSites.toLocaleString()}</div>
            </div>
            <div className="item">
              <div className="k">Trial/site rows found (last {RECENT_YEARS} yrs)</div>
              <div className="v">{recentFacilities.length.toLocaleString()}</div>
            </div>
          </div>

          <div className="map-controls">
            <input
              type="search"
              className="map-search-input"
              placeholder="Search trial, site, city, or country…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              title="Filter rows by trial status"
            >
              <option value="all">All statuses</option>
              <option value="recruiting">Recruiting</option>
              <option value="not_yet_recruiting">Not Yet Recruiting</option>
              <option value="active_not_recruiting">
                Active, Not Recruiting
              </option>
              <option value="enrolling_by_invitation">
                Enrolling By Invitation
              </option>
              <option value="completed">Completed</option>
              <option value="other">
                Other (Terminated/Withdrawn/Suspended/Unknown)
              </option>
            </select>
            <span className="map-table-count">
              {filtered.length.toLocaleString()} of{" "}
              {recentFacilities.length.toLocaleString()} row(s)
            </span>
          </div>

          <div className="table-scroll">
            <table className="competing-trials-table">
              <colgroup>
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
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
                      <td
                        title={f.briefTitle ?? undefined}
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
                      </td>
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
                        title={f.facility || location || undefined}
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
                        {data.indication}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="predict-placeholder">
                      {facilities.length === 0
                        ? "No trials found on ClinicalTrials.gov for this indication."
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
