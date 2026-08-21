import { useSiteMap } from "../../context/SiteMapContext";
import {
  SITE_MAP_RADIUS_MILES,
  downloadCsv,
  riskBand,
  segmentsLine,
  sitesToCsv,
} from "../../utils/siteMapFormat";

/**
 * "Site Map Details" page — the sortable per-site table, per-site detail
 * panels (sample patients), and the combined-catchment comparator that used
 * to live below the map inside the old SiteMapView.tsx tab. Reads the same
 * shared SiteMapContext as the Site Map (Global) page, so search/sort/
 * filter/selection state is identical whichever page you're on — nothing
 * refetches when you switch between them.
 */
export default function SiteMapDetailsPage() {
  const {
    indication,
    country,
    data,
    loading,
    error,
    allSites,
    sortedSites,
    selectedSiteId,
    setSelectedSiteId,
    search,
    setSearch,
    sortArrow,
    toggleSort,
    combineIds,
    toggleCombine,
    combineResult,
    combineLoading,
    combineError,
    computeCombined,
    clearCombine,
    eligFilters,
    eligFiltersLoading,
    eligFiltersError,
    selectedFilterIds,
    toggleEligFilter,
    clearEligFilters,
    allFiltersSelected,
    toggleSelectAllFilters,
    activeEligFilters,
    filterPanelOpen,
    setFilterPanelOpen,
    excludeEnrolled,
    setExcludeEnrolled,
    baseAvailable,
    adjustedNetAvailable,
    expectedRecruitment,
  } = useSiteMap();

  function handleExportCsv() {
    if (sortedSites.length === 0) return;
    const filenameParts = [
      "site-map",
      indication || "indication",
      country || "global",
    ];
    const filename = `${filenameParts
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")}.csv`;
    downloadCsv(sitesToCsv(sortedSites), filename);
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="predict-title">Site Map Details</span>
          </div>
        </div>
        <p className="section-hint">
          Every site plotted on the Site Map (Global) page, as a sortable
          table with per-site detail — for{" "}
          {indication || "the selected indication"}.
        </p>
      </div>

      <div className="card-scroll-body">
        {error && <p className="error-text">{error}</p>}

        {!data && !loading && !error && (
          <p className="predict-placeholder">
            No search yet — run a search from the Site Map (Global) page to
            populate this table.
          </p>
        )}

        {data && allSites.length > 0 && (
          <>
            <div className="map-table-toolbar">
              <input
                type="search"
                className="map-search-input"
                placeholder="Search site, city, state, or country…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="map-table-count">
                {sortedSites.length.toLocaleString()} of{" "}
                {allSites.length.toLocaleString()} site(s)
              </span>
              <button
                type="button"
                className="map-csv-btn"
                onClick={handleExportCsv}
                disabled={sortedSites.length === 0}
              >
                Export CSV
              </button>
            </div>

            <label
              title="Uncheck to compare against the total eligible population, including patients already enrolled in another trial for this indication"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                margin: "8px 0",
              }}
            >
              <input
                type="checkbox"
                checked={excludeEnrolled}
                onChange={(e) => setExcludeEnrolled(e.target.checked)}
              />
              Exclude patients already enrolled in another trial
              {(() => {
                const totalAvailable = sortedSites.reduce(
                  (sum, s) => sum + adjustedNetAvailable(s),
                  0,
                );
                const totalEnrolled = sortedSites.reduce(
                  (sum, s) => sum + s.alreadyEnrolledPatients,
                  0,
                );
                return (
                  <>
                    <span style={{ color: "#666", fontWeight: 600 }}>
                      {excludeEnrolled
                        ? `Available patients: ${totalAvailable.toLocaleString()}`
                        : `Available + enrolled: ${totalAvailable.toLocaleString()}`}
                    </span>
                    <span style={{ color: "#888" }}>
                      (already enrolled elsewhere: {totalEnrolled.toLocaleString()})
                    </span>
                  </>
                );
              })()}
            </label>

            <p className="section-hint">
              Check 2 or more sites below to see how many patients they
              actually reach TOGETHER — nearby sites often share the same
              catchment, so simply adding up each site's own number can
              overstate the real total.
            </p>

            <div className="table-scroll">
              <table
                className="site-map-table"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "11%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      title="Check to compare combined catchment across sites"
                      style={{ padding: "8px 4px" }}
                    ></th>
                    <th className="sortable" onClick={() => toggleSort("site")}>
                      Site{sortArrow("site")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("location")}>
                      Location{sortArrow("location")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("gross")}>
                      Gross Eligible{sortArrow("gross")}
                    </th>
                    <th
                      style={{ position: "relative", overflow: "visible" }}
                      title={
                        excludeEnrolled
                          ? "Eligible patients minus an estimated already-enrolled-elsewhere share"
                          : "Eligible patients including those already enrolled in another trial elsewhere"
                      }
                    >
                      {excludeEnrolled ? "Available" : "Available + Enrolled"}{" "}
                      <button
                        type="button"
                        className="net-available-filter-btn"
                        title="Filter by inclusion/exclusion criteria"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterPanelOpen((v) => !v);
                        }}
                        style={{
                          border: "none",
                          background: activeEligFilters.length > 0 ? "#2f7d4f" : "#e3e7f0",
                          color: activeEligFilters.length > 0 ? "#fff" : "#333",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        ▾{activeEligFilters.length > 0 ? ` ${activeEligFilters.length}` : ""}
                      </button>

                      {filterPanelOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            zIndex: 1000,
                            width: 320,
                            maxHeight: 320,
                            overflowY: "auto",
                            background: "#fff",
                            border: "1px solid #d7dbe6",
                            borderRadius: 6,
                            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                            padding: 8,
                            textAlign: "left",
                            fontWeight: 400,
                            textTransform: "none",
                          }}
                        >
                          {eligFiltersLoading && (
                            <div style={{ fontSize: 12, padding: 4 }}>Loading…</div>
                          )}
                          {eligFiltersError && (
                            <div style={{ fontSize: 12, padding: 4, color: "#b3261e" }}>
                              {eligFiltersError}
                            </div>
                          )}
                          {eligFilters?.warning && (
                            <div style={{ fontSize: 11.5, padding: 4, color: "#8a6d00" }}>
                              {eligFilters.warning}
                            </div>
                          )}

                          {eligFilters && eligFilters.filters.length > 0 && (
                            <>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  fontSize: 12.5,
                                  padding: "4px 4px",
                                  borderBottom: "1px solid #eee",
                                  marginBottom: 4,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={allFiltersSelected}
                                  onChange={toggleSelectAllFilters}
                                />
                                <strong>(Select All)</strong>
                              </label>

                              {eligFilters.filters.map((f) => (
                                <label
                                  key={f.id}
                                  title={`${f.type} — ~${f.estimatedExcludedPercent}% of the general population excluded (AI-estimated)`}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 12.5,
                                    padding: "3px 4px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedFilterIds.has(f.id)}
                                    onChange={() => toggleEligFilter(f.id)}
                                  />
                                  <span style={{ flex: 1 }}>{f.label}</span>
                                  <span style={{ color: "#888", fontSize: 11 }}>
                                    ~{f.estimatedExcludedPercent}%
                                  </span>
                                </label>
                              ))}

                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginTop: 8,
                                  paddingTop: 6,
                                  borderTop: "1px solid #eee",
                                }}
                              >
                                <button
                                  type="button"
                                  className="map-csv-btn"
                                  onClick={clearEligFilters}
                                  disabled={activeEligFilters.length === 0}
                                >
                                  Clear
                                </button>
                                <button
                                  type="button"
                                  className="predict-btn"
                                  onClick={() => setFilterPanelOpen(false)}
                                >
                                  Done
                                </button>
                              </div>

                              {eligFilters.criteriaText && (
                                <details style={{ marginTop: 6 }}>
                                  <summary style={{ cursor: "pointer", fontSize: 11, color: "#666" }}>
                                    View full raw criteria text
                                  </summary>
                                  <pre
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      marginTop: 6,
                                      fontFamily: "inherit",
                                      fontSize: 11.5,
                                      maxHeight: 160,
                                      overflowY: "auto",
                                    }}
                                  >
                                    {eligFilters.criteriaText}
                                  </pre>
                                </details>
                              )}
                            </>
                          )}

                          {eligFilters && eligFilters.filters.length === 0 && !eligFiltersLoading && (
                            <div style={{ fontSize: 12, padding: 4, color: "#888" }}>
                              No filterable criteria available for this indication.
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                    <th title="Available x this site's own synthetic consent/conversion rate — 100 eligible patients doesn't mean 100 enrolled">
                      Expected Recruitment
                    </th>
                    <th title="Illustrative split of Net Available — not real claims data">
                      Segments (illustrative)
                    </th>
                    <th className="sortable" onClick={() => toggleSort("risk")}>
                      Risk{sortArrow("risk")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSites.map((s) => {
                    const location = [s.city, s.state, s.country]
                      .filter(Boolean)
                      .join(", ");
                    return (
                      <tr
                        key={s.siteId}
                        className={selectedSiteId === s.siteId ? "pinned-row" : ""}
                        onClick={() => setSelectedSiteId(s.siteId)}
                      >
                        <td
                          onClick={(e) => e.stopPropagation()}
                          style={{ padding: "8px 4px", textAlign: "center" }}
                        >
                          <input
                            type="checkbox"
                            checked={combineIds.has(s.siteId)}
                            onChange={() => toggleCombine(s.siteId)}
                            title="Include in combined-catchment comparison"
                          />
                        </td>
                        <td
                          title={s.siteName}
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.siteName}
                        </td>
                        <td
                          title={location}
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {location}
                        </td>
                        <td>{s.grossEligiblePatients.toLocaleString()}</td>
                        <td
                          title={
                            activeEligFilters.length > 0
                              ? `${baseAvailable(s).toLocaleString()} before filters — adjusted using ${activeEligFilters.length} selected criterion/criteria (illustrative estimate, not exact)`
                              : `Already enrolled elsewhere: ${s.alreadyEnrolledPatients.toLocaleString()}`
                          }
                        >
                          {adjustedNetAvailable(s).toLocaleString()}
                          {activeEligFilters.length > 0 && (
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "#888",
                                textDecoration: "line-through",
                              }}
                            >
                              {baseAvailable(s).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td
                          title={`${(Math.round(s.assumedConsentRate * 1000) / 10).toFixed(1)}% assumed consent/conversion rate (synthetic, varies per site) applied to the Available figure above`}
                        >
                          {expectedRecruitment(s).toLocaleString()}
                          <span style={{ display: "block", fontSize: 11, color: "#888" }}>
                            {(Math.round(s.assumedConsentRate * 1000) / 10).toFixed(1)}% consent rate
                          </span>
                        </td>
                        <td
                          title={s.patientSegments ? segmentsLine(s) : "n/a"}
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.patientSegments
                            ? `${(s.patientSegments.newlyDiagnosed + s.patientSegments.nonResponder).toLocaleString()} recruitable`
                            : "n/a"}
                        </td>
                        <td>
                          <span
                            className={`badge ${riskBand(s.riskScore)}`}
                            title={`${s.riskLevel} risk (AI-labeled) — ${s.riskRationale}`}
                          >
                            {s.riskScore !== null ? `${s.riskScore}/100` : "N/A"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedSites.length === 0 && (
                    <tr>
                      <td colSpan={8} className="predict-placeholder">
                        No sites match "{search}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {combineIds.size > 0 && (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <strong>{combineIds.size} site(s) selected</strong>
                  <button
                    type="button"
                    className="predict-btn"
                    onClick={computeCombined}
                    disabled={combineIds.size < 2 || combineLoading}
                  >
                    {combineLoading ? (
                      <>
                        <span className="spinner" /> Computing…
                      </>
                    ) : (
                      "Calculate combined catchment"
                    )}
                  </button>
                  <button type="button" className="link-btn" onClick={clearCombine}>
                    Clear
                  </button>
                </div>
                {combineIds.size < 2 && (
                  <p className="section-hint">Select at least one more site to compare.</p>
                )}
                {combineError && <p className="error-text">{combineError}</p>}
                {combineResult && (
                  <div className="final-grid" style={{ marginTop: 10 }}>
                    <div className="item">
                      <div className="k">Sum of each site's own number</div>
                      <div className="v">
                        {combineResult.sumOfIndividualNetAvailablePatients.toLocaleString()}
                      </div>
                    </div>
                    <div className="item">
                      <div className="k">Actual combined (de-duplicated)</div>
                      <div className="v">
                        {combineResult.combinedNetAvailablePatients.toLocaleString()}
                      </div>
                    </div>
                    <div className="item">
                      <div className="k">Overlap (double-counted if summed)</div>
                      <div className="v">
                        {combineResult.overlapPatients.toLocaleString()}
                        {combineResult.overlapPatients > 0 && (
                          <span className="badge medium" style={{ marginLeft: 6 }}>
                            overlap found
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {combineResult &&
                  combineResult.warnings.map((w, i) => (
                    <p key={i} className="warning-text">
                      {w}
                    </p>
                  ))}
              </div>
            )}

            <p className="map-caveats">
              Methodology: the map background and place names on the Site
              Map (Global) page are a real live map (OpenStreetMap). Site
              coordinates are geocoded live via Google Maps (if a key is
              configured on the backend) or the free OpenStreetMap Nominatim
              service, in that order — only falling back to an
              approximation near the facility's city/country when neither
              live lookup succeeds (
              {allSites.filter((s) => s.coordsSource === "approximate").length}{" "}
              of {allSites.length} site(s) here). Each site's{" "}
              {SITE_MAP_RADIUS_MILES}-mile catchment is now checked using
              real driving distance (Google Distance Matrix, or the free
              OSRM router) wherever available — only falling back to
              straight-line distance when neither succeeds (
              {
                allSites.filter(
                  (s) =>
                    s.catchmentDistanceSource === "approximate-haversine" ||
                    s.catchmentDistanceSource === "mixed",
                ).length
              }{" "}
              of {allSites.length} site(s) had some or all points fall back
              this way). Patient population within the radius comes from a
              synthetic dataset — no live public source publishes real
              population by postal area for arbitrary countries — combined
              with an AI-estimated disease prevalence rate. The "Exclude
              patients already enrolled in another trial" checkbox above
              the table toggles between "Available" (eligible patients minus
              an estimated already-enrolled-elsewhere share, from real
              completed-trial benchmarks when available, else a fixed
              baseline) and "Available + Enrolled" (the full eligible
              population). A small illustrative sample of synthetic
              patient-level records per site (Patient ID, age, named
              comorbidity flags, Available/Enrolled status) is available via
              "View sample patients" above — fabricated data standing in for
              real per-patient EHR/claims/CTMS records, which have no live
              public source. "Expected Recruitment" applies each site's own
              synthetic consent/conversion rate (shown under the number) to
              the Available figure — eligible patients don't all convert to
              enrolled patients, so this is Available × rate, not the full
              Available population. No live or LLM source discloses a real
              per-site conversion rate, so this rate is a fabricated,
              per-site variation around the app's configured default, not a
              measured figure. The Segments column further splits Available
              into illustrative treatment-stage buckets (newly-diagnosed /
              non-responder / stable) using a fixed assumption, not real
              claims data — see each site's popup on the Site Map (Global)
              page for the full breakdown. Risk scores are AI-estimated — no
              public per-site clinical-trial risk database was found.
            </p>
          </>
        )}

        {data && allSites.length === 0 && !error && (
          <p className="predict-placeholder">No live sites found for this search.</p>
        )}
      </div>
    </div>
  );
}
