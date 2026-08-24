import { useSiteMap } from "../../context/SiteMapContext";
import {
  downloadCsv,
  riskBand,
  segmentsLine,
  sitesToCsv,
} from "../../utils/siteMapFormat";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

export default function SiteMapDetailsPage() {
  const {
    indication,
    country,
    setCountry,
    selectedCountries,
    runSearch,
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

  // Highlighted column header styling matching the app's accent theme
  const thStyle: React.CSSProperties = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent-dark)",
    fontWeight: 800,
    position: "sticky",
    top: 0,
    zIndex: 2,
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="predict-head" style={{ flexShrink: 0 }}>
        <div className="predict-head-top">
        </div>
      </div>

      <div className="map-controls" style={{ alignItems: "flex-end", flexShrink: 0 }}>
        <label className="map-field">
          <span>Country</span>
          {selectedCountries && selectedCountries.length > 0 ? (
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {selectedCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <select value="" disabled>
              <option value="">All countries</option>
            </select>
          )}
        </label>
        <button
          type="button"
          className="predict-btn"
          onClick={runSearch}
          disabled={loading || !indication}
          style={{ height: "37px" }}
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

      <div 
        className="card-scroll-body" 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          overflow: "hidden", 
          paddingRight: 0, 
          marginRight: 0 
        }}
      >
        {error && <p className="error-text" style={{ flexShrink: 0 }}>{error}</p>}

        {loading && <StageLoader label="Loading site map details…" />}

        {!data && !loading && !error && (
          <p className="predict-placeholder" style={{ flexShrink: 0 }}>
            No search yet — pick your filters and click Search to populate this table.
          </p>
        )}

        {data && data.warnings.length > 0 && (
          <div className="map-warnings" style={{ flexShrink: 0 }}>
            {data.warnings.map((w, i) => (
              <p key={i} className="warning-text">
                {w}
              </p>
            ))}
          </div>
        )}

        {data && allSites.length > 0 && (
          <>
            <div style={{ flexShrink: 0, paddingRight: 10 }}>
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
            </div>

            <div className="table-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 10 }}>
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
                      style={{ ...thStyle, padding: "8px 4px" }}
                    ></th>
                    <th className="sortable" style={thStyle} onClick={() => toggleSort("site")}>
                      Site{sortArrow("site")}
                    </th>
                    <th className="sortable" style={thStyle} onClick={() => toggleSort("location")}>
                      Location{sortArrow("location")}
                    </th>
                    <th className="sortable" style={thStyle} onClick={() => toggleSort("gross")}>
                      Gross Eligible{sortArrow("gross")}
                    </th>
                    <th
                      style={{ ...thStyle, position: "sticky", overflow: "visible" }}
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
                            width: 380,
                            maxHeight: 380,
                            display: "flex",
                            flexDirection: "column",
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                            borderRadius: 6,
                            boxShadow: "var(--shadow)",
                            textAlign: "left",
                            fontWeight: 400,
                            textTransform: "none",
                          }}
                        >
                          {/* Scrollable Criteria Area */}
                          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                            {eligFiltersLoading && (
                              <div style={{ fontSize: 12, padding: 4 }}>Loading…</div>
                            )}
                            {eligFiltersError && (
                              <div style={{ fontSize: 12, padding: 4, color: "var(--high)" }}>
                                {eligFiltersError}
                              </div>
                            )}
                            {eligFilters?.warning && (
                              <div style={{ fontSize: 11.5, padding: 4, color: "var(--med)" }}>
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
                                    borderBottom: "1px solid var(--line)",
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
                                    title={`${f.detail}\n\n(${f.type} — ~${f.estimatedExcludedPercent}% of the general population excluded, AI-estimated)`}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 8,
                                      fontSize: 12.5,
                                      padding: "4px 4px",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedFilterIds.has(f.id)}
                                      onChange={() => toggleEligFilter(f.id)}
                                      style={{ marginTop: 2 }}
                                    />
                                    <span
                                      style={{
                                        flex: 1,
                                        whiteSpace: "normal",
                                        wordBreak: "break-word",
                                        lineHeight: 1.35,
                                      }}
                                    >
                                      {f.label}
                                    </span>
                                    <span
                                      style={{
                                        color: "var(--sub)",
                                        fontSize: 11,
                                        flexShrink: 0,
                                        paddingTop: 1,
                                      }}
                                    >
                                      ~{f.estimatedExcludedPercent}%
                                    </span>
                                  </label>
                                ))}
                              </>
                            )}

                            {eligFilters && eligFilters.filters.length === 0 && !eligFiltersLoading && (
                              <div style={{ fontSize: 12, padding: 4, color: "var(--sub)" }}>
                                No filterable criteria available for this indication.
                              </div>
                            )}
                          </div>
                          
                          {/* Static Footer Buttons */}
                          {eligFilters && eligFilters.filters.length > 0 && (
                            <div
                              style={{
                                flexShrink: 0,
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "8px 12px",
                                borderTop: "1px solid var(--line)",
                                background: "var(--card)",
                                borderRadius: "0 0 6px 6px",
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
                                style={{ padding: "6px 14px", fontSize: 12.5 }}
                                onClick={() => setFilterPanelOpen(false)}
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                    <th style={thStyle} title="Available x this site's own synthetic consent/conversion rate — 100 eligible patients doesn't mean 100 enrolled">
                      Expected Recruitment
                    </th>
                    <th style={thStyle} title="Illustrative split of Net Available — not real claims data">
                      Segments (illustrative)
                    </th>
                    <th className="sortable" style={thStyle} onClick={() => toggleSort("risk")}>
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
                                color: "var(--sub)",
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
                          <span style={{ display: "block", fontSize: 11, color: "var(--sub)" }}>
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
              <div className="card" style={{ marginTop: 12, padding: 12, flexShrink: 0 }}>
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
          </>
        )}

        {data && allSites.length === 0 && !error && (
          <p className="predict-placeholder" style={{ flexShrink: 0 }}>No live sites found for this search.</p>
        )}
      </div>
      <WizardNextLink />
    </div>
  );
}