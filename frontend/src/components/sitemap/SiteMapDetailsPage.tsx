import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSiteMap } from "../../context/SiteMapContext";
import {
  downloadCsv,
  riskBand,
  segmentsLine,
  sitesToCsv,
} from "../../utils/siteMapFormat";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import Tooltip from "../ui/Tooltip";
import EmptyState from "../ui/EmptyState";

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
    setCountry,
    selectedCountries,
    data,
    loading,
    error,
    allSites,
    sortedSites,
    selectedSiteId,
    setSelectedSiteId,
    search,
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

  // The eligibility-filter dropdown (opened from the "Available" column
  // header) is rendered through a portal into document.body, positioned
  // via this header cell's own bounding rect — same reasoning as Select.tsx:
  // an absolutely-positioned 380px-wide panel nested inside a fixed-layout
  // <table>/<th> was both getting clipped by the table's scroll container
  // and distorting the table's own column widths. A portal escapes both.
  const filterHeaderRef = useRef<HTMLTableCellElement>(null);
  const [filterPanelRect, setFilterPanelRect] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!filterPanelOpen) return;
    const updateRect = () => {
      const el = filterHeaderRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setFilterPanelRect({ top: rect.bottom + 4, left: rect.left });
    };
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [filterPanelOpen]);

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
      <div className="map-controls map-controls--flush">
        {/* No tooltip here — this label sits at the very top of the card,
            so a hover bubble that opens upward has nowhere to render and
            just shows up as a box clipped above the viewport. */}
        <label className="map-field">
          {selectedCountries.length > 0 ? (
            <Select
              value={country}
              onChange={setCountry}
              disabled={loading}
              options={selectedCountries.map((c) => ({ value: c, label: c }))}
            />
          ) : (
            <>
              <Select value="" onChange={() => {}} disabled options={[{ value: "", label: "All countries" }]} />
              <span className="map-field-note">
                No region selected yet — pick one in Step 1 (or apply an AI
                prediction) to narrow this.
              </span>
            </>
          )}
        </label>
        {/* Kept in the same row as the Country control above (instead of a
            separate toolbar row further down) so "pick a country -> search
            -> export" reads as one continuous bar. Only shown once there's
            a table to export. The site-name search box and the "N of N
            site(s)" count that used to sit here were removed per request —
            the table just lists every site now, with no text filter. */}
        {data && allSites.length > 0 && (
          <button
            type="button"
            className="map-csv-btn"
            onClick={handleExportCsv}
            disabled={sortedSites.length === 0}
          >
            Export CSV
          </button>
        )}
      </div>

      <div className="card-scroll-body" style={{ position: "relative" }}>
        {error && <p className="error-text">{error}</p>}

        {/* Overlays the (possibly still-showing stale) table below instead
            of squeezing into its own slot above it, so the spinner sits
            centered in the middle of the visible panel rather than in a
            small empty gap near the top. */}
        {loading && (
          <div className="table-loading-overlay">
            <StageLoader label="Loading site map details…" />
          </div>
        )}

        {!data && !loading && !error && (
          <EmptyState
            title="No search yet"
            detail="Run a search from the Site Map (Global) page to populate this table."
          />
        )}

        {data && allSites.length > 0 && (
          <>

            <label
              data-tooltip="Uncheck to compare against the total eligible population, including patients already enrolled in another trial for this indication"
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
                    <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                      {excludeEnrolled
                        ? `Available patients: ${totalAvailable.toLocaleString()}`
                        : `Available + enrolled: ${totalAvailable.toLocaleString()}`}
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      (already enrolled elsewhere: {totalEnrolled.toLocaleString()})
                    </span>
                  </>
                );
              })()}
            </label>

            <div className="table-scroll">
              <table
                className="site-map-table"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "14%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th
                      data-tooltip="Check to compare combined catchment across sites"
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
                      ref={filterHeaderRef}
                      // No inline position:relative here — an inline style
                      // always wins over the shared `th { position: sticky }`
                      // rule regardless of specificity, which was silently
                      // stopping just this one header cell from sticking.
                      // The filter panel below is portaled and positioned
                      // via getBoundingClientRect() already, so it never
                      // actually needed this <th> to be a positioned
                      // ancestor — sticky already counts as positioned for
                      // any descendant that does need one.
                      data-tooltip={
                        excludeEnrolled
                          ? "Eligible patients minus an estimated already-enrolled-elsewhere share"
                          : "Eligible patients including those already enrolled in another trial elsewhere"
                      }
                    >
                      {excludeEnrolled ? "Available" : "Available + Enrolled"}{" "}
                      <button
                        type="button"
                        className="net-available-filter-btn"
                        data-tooltip="Filter by inclusion/exclusion criteria"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterPanelOpen((v) => !v);
                        }}
                        style={{
                          border: "none",
                          background: activeEligFilters.length > 0 ? "var(--success)" : "var(--border)",
                          color: activeEligFilters.length > 0 ? "var(--card)" : "var(--text-primary)",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        ▾{activeEligFilters.length > 0 ? ` ${activeEligFilters.length}` : ""}
                      </button>

                      {filterPanelOpen &&
                        filterPanelRect &&
                        createPortal(
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "fixed",
                            top: filterPanelRect.top,
                            left: filterPanelRect.left,
                            zIndex: 3000,
                            // Wider than before (320 -> 380) and no horizontal
                            // scrolling — labels are now capped at 45 chars
                            // server-side and wrap onto a second line if
                            // needed instead of being cut off or requiring a
                            // horizontal scrollbar to read.
                            width: 380,
                            maxHeight: 380,
                            overflowY: "auto",
                            overflowX: "hidden",
                            background: "var(--card)",
                            border: "1px solid var(--border)",
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
                            <div style={{ fontSize: 12, padding: 4, color: "var(--danger)" }}>
                              {eligFiltersError}
                            </div>
                          )}
                          {eligFilters?.warning && (
                            <div style={{ fontSize: 11.5, padding: 4, color: "color-mix(in srgb, var(--warning) 70%, black)" }}>
                              {eligFilters.warning}
                            </div>
                          )}

                          {eligFilters && eligFilters.filters.length > 0 && (
                            <>
                              {/* Sticky at the top of the scrollable panel
                                  (negative margin + matching padding to
                                  extend under the panel's own 8px padding)
                                  so it stays visible while the filter list
                                  below it scrolls. */}
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  fontSize: 12.5,
                                  position: "sticky",
                                  top: -8,
                                  zIndex: 2,
                                  background: "var(--card)",
                                  margin: "-8px -8px 4px",
                                  padding: "8px 8px 4px",
                                  borderBottom: "1px solid var(--border)",
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
                                  data-tooltip={`${f.detail}\n\n(${f.type} — ~${f.estimatedExcludedPercent}% of the general population excluded, AI-estimated)`}
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
                                  {/* Labels are capped at 45 chars server-side,
                                      so this wraps onto at most two short
                                      lines instead of being cut off or forcing
                                      a horizontal scrollbar — the fuller
                                      clinical wording is in the title tooltip
                                      above, not squeezed into this line. */}
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
                                      color: "var(--text-secondary)",
                                      fontSize: 11,
                                      flexShrink: 0,
                                      paddingTop: 1,
                                    }}
                                  >
                                    ~{f.estimatedExcludedPercent}%
                                  </span>
                                </label>
                              ))}

                              {/* Sticky at the bottom, same trick as the
                                  header above, so Clear/Done stay reachable
                                  without scrolling all the way down. */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  position: "sticky",
                                  bottom: -8,
                                  zIndex: 2,
                                  background: "var(--card)",
                                  margin: "8px -8px -8px",
                                  padding: "6px 8px 8px",
                                  borderTop: "1px solid var(--border)",
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

                            </>
                          )}

                          {eligFilters && eligFilters.filters.length === 0 && !eligFiltersLoading && (
                            <div style={{ fontSize: 12, padding: 4, color: "var(--text-secondary)" }}>
                              No filterable criteria available for this indication.
                            </div>
                          )}
                        </div>,
                        document.body,
                      )}
                    </th>
                    <th
                      data-tooltip="Available x this site's own synthetic consent/conversion rate — 100 eligible patients doesn't mean 100 enrolled"
                      style={{ whiteSpace: "normal", lineHeight: 1.3 }}
                    >
                      Expected Recruitment
                    </th>
                    <th
                      data-tooltip="Illustrative split of Net Available — not real claims data"
                      style={{ whiteSpace: "normal", lineHeight: 1.3 }}
                    >
                      Segments (illustrative)
                    </th>
                    <th
                      className="sortable"
                      onClick={() => toggleSort("risk")}
                      style={{ whiteSpace: "normal", lineHeight: 1.3 }}
                    >
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
                            data-tooltip="Include in combined-catchment comparison"
                          />
                        </td>
                        <td
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.siteName}
                        </td>
                        <td
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {location}
                        </td>
                        <td
                          data-tooltip={
                            s.populationInRadius === 0
                              ? "No population data available for this site's catchment area — not a real zero"
                              : undefined
                          }
                        >
                          {s.populationInRadius === 0
                            ? "No data found"
                            : s.grossEligiblePatients.toLocaleString()}
                        </td>
                        <td>
                          {s.populationInRadius === 0 ? (
                            "No data found"
                          ) : (
                            <>
                              {adjustedNetAvailable(s).toLocaleString()}
                              {activeEligFilters.length > 0 && (
                                <span
                                  style={{
                                    display: "block",
                                    fontSize: 11,
                                    color: "var(--text-secondary)",
                                    textDecoration: "line-through",
                                  }}
                                >
                                  {baseAvailable(s).toLocaleString()}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                        <td
                          data-tooltip={
                            s.populationInRadius === 0
                              ? "No population data available for this site's catchment area — not a real zero"
                              : `${(Math.round(s.assumedConsentRate * 1000) / 10).toFixed(1)}% assumed consent/conversion rate (synthetic, varies per site) applied to the Available figure above`
                          }
                        >
                          {s.populationInRadius === 0 ? (
                            "No data found"
                          ) : (
                            <>
                              {expectedRecruitment(s).toLocaleString()}
                              <span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)" }}>
                                {(Math.round(s.assumedConsentRate * 1000) / 10).toFixed(1)}% consent rate
                              </span>
                            </>
                          )}
                        </td>
                        <Tooltip
                          as="td"
                          text={
                            s.patientSegments
                              ? segmentsLine(s)
                              : s.populationInRadius === 0
                                ? "No population data available for this site's catchment area — not a real zero"
                                : "n/a"
                          }
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.patientSegments
                            ? `${(s.patientSegments.newlyDiagnosed + s.patientSegments.nonResponder).toLocaleString()} recruitable`
                            : s.populationInRadius === 0
                              ? "No data found"
                              : "n/a"}
                        </Tooltip>
                        <td>
                          <span
                            className={`badge ${riskBand(s.riskScore)}`}
                            data-tooltip={`${s.riskLevel} risk (AI-labeled) — ${s.riskRationale}`}
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
                  <button
                    type="button"
                    className="link-btn"
                    onClick={clearCombine}
                    style={{ marginTop: 0 }}
                  >
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
              </div>
            )}
          </>
        )}

        {data && allSites.length === 0 && !error && (
          <EmptyState icon="🔍" title="No live sites found" detail="Try a different country or clear the eligibility filters." />
        )}
      </div>
      <WizardNextLink />
    </div>
  );
}
