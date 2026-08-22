import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveTrialLandscapeResponse } from "../../types";
import { fetchLiveTrialLandscape } from "../../services/liveTrials.service";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

export default function CompetingTrialsPanel({
  indication,
  selectedCountries = [],
}: {
  indication: string;
  /** Countries pulled from the trial form's already-selected regions — same convention as SiteMapView. Empty = only "All countries" is offered. */
  selectedCountries?: string[];
}) {
  const [country, setCountry] = useState("");
  const [data, setData] = useState<LiveTrialLandscapeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const filtered = search.trim()
    ? recentFacilities.filter((f) =>
        [f.nctId, f.briefTitle, f.facility, f.city, f.state, f.country]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(search.trim().toLowerCase())),
      )
    : recentFacilities;

  function statusLabel(status: string | null): string {
    if (!status) return "Unknown";
    return status
      .toLowerCase()
      .split("_")
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(" ");
  }

  // Colors each trial's status the same way the Risk Register colors its
  // risk levels — reusing the exact same .badge/--low/--med/--high/--no-data
  // classes/tokens, instead of the flat neutral .chip this table used
  // before, so a status carries the same at-a-glance visual weight here as
  // a risk rating does there. RECRUITING/COMPLETED read as "healthy"
  // (green); ACTIVE_NOT_RECRUITING/NOT_YET_RECRUITING/ENROLLING_BY_INVITATION
  // as an in-between/caution state (amber); the stopped-for-cause statuses
  // (TERMINATED/WITHDRAWN/SUSPENDED) as high (red); anything else
  // (null/unrecognized) falls back to the same grey "no-data" treatment
  // used for an unassessed risk record.
  function statusBand(status: string | null): "low" | "medium" | "high" | "no-data" {
    const s = (status ?? "").toUpperCase();
    if (s === "RECRUITING" || s === "COMPLETED") return "low";
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
              <div className="k">Active / competing trials</div>
              <div className="v">
                {data.activeCompetingTrials !== null
                  ? data.activeCompetingTrials.toLocaleString()
                  : "N/A"}
              </div>
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
                        : `No rows match "${search}".`}
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
