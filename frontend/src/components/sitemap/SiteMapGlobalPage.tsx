import { useEffect, useMemo, useRef, useState } from "react";
import L from "../../lib/leafletGlobal";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { MapSiteRow } from "../../types";
import { useIndependentSiteSearch } from "../../hooks/useIndependentSiteSearch";
import { usePipeline } from "../../hooks/usePipeline";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import EmptyState from "../ui/EmptyState";
import { allConfiguredCountries } from "../../utils/region";
import {
  MILES_TO_METERS,
  SITE_MAP_METRIC,
  catchmentDistanceLabel,
  coordsSourceLabel,
  escapeHtml,
  segmentsLine,
} from "../../utils/siteMapFormat";

const WORLD_CENTER: [number, number] = [20, 0];
const WORLD_ZOOM = 2;

const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

function buildPopupHtml(s: MapSiteRow, metric: "gross" | "net"): string {
  const location = [s.city, s.state, s.country]
    .filter((v): v is string => !!v)
    .map(escapeHtml)
    .join(", ");
  const grossLine = `Gross eligible: ${s.grossEligiblePatients.toLocaleString()}`;
  const netLine = `Net available: ${s.netAvailablePatients.toLocaleString()}`;
  const enrolledLine = `Already enrolled elsewhere: ${s.alreadyEnrolledPatients.toLocaleString()}`;
  const expectedRecruitmentLine =
    `Expected recruitment: ${Math.round(s.netAvailablePatients * s.assumedConsentRate).toLocaleString()} ` +
    `(${(Math.round(s.assumedConsentRate * 1000) / 10).toFixed(1)}% assumed consent rate)`;
  const primary = metric === "net" ? netLine : grossLine;
  const secondary = metric === "net" ? grossLine : netLine;
  const riskLine = s.riskScore !== null ? `${s.riskScore}/100` : "N/A";
  return `
    <div class="site-popup">
      <strong>${escapeHtml(s.siteName)}</strong>
      <div>${location}</div>
      <div><strong>${primary}</strong></div>
      <div>${secondary}</div>
      <div>${enrolledLine}</div>
      <div>${expectedRecruitmentLine}</div>
      <div>Risk score: ${riskLine}</div>
      <div class="site-popup-rationale">${escapeHtml(s.riskRationale)}</div>
      ${s.patientSegments ? `<div class="site-popup-caveat">${escapeHtml(segmentsLine(s))}</div>` : ""}
      <div class="site-popup-caveat">Coordinates: ${coordsSourceLabel(s.coordsSource)} · Radius distance: ${catchmentDistanceLabel(s.catchmentDistanceSource)} · Population: synthetic</div>
    </div>
  `;
}

function buildMarkerTooltipHtml(s: MapSiteRow): string {
  const location = [s.city, s.state, s.country]
    .filter((v): v is string => !!v)
    .map(escapeHtml)
    .join(", ");
  const riskLine = s.riskScore !== null ? `${s.riskScore}/100` : "N/A";
  return `
    <div class="site-tooltip">
      <strong>${escapeHtml(s.siteName)}</strong>
      <div>${location}</div>
      <div>Gross eligible: ${s.grossEligiblePatients.toLocaleString()}</div>
      <div>Net available: ${s.netAvailablePatients.toLocaleString()}</div>
      <div>Risk score: ${riskLine}</div>
    </div>
  `;
}

function buildClusterTooltipHtml(sites: MapSiteRow[]): string {
  const totalGross = sites.reduce((sum, s) => sum + s.grossEligiblePatients, 0);
  const totalNet = sites.reduce((sum, s) => sum + s.netAvailablePatients, 0);
  const locations = [
    ...new Set(
      sites
        .map((s) =>
          [s.city, s.country].filter((v): v is string => !!v).join(", "),
        )
        .filter(Boolean),
    ),
  ];
  const shown = locations.slice(0, 4).map(escapeHtml).join("<br/>");
  const more =
    locations.length > 4
      ? `<div class="site-popup-caveat">+${locations.length - 4} more location(s)</div>`
      : "";
  return `
    <div class="site-tooltip">
      <strong>${sites.length} sites in this area</strong>
      <div>${shown}</div>
      ${more}
      <div>Combined gross eligible: ${totalGross.toLocaleString()}</div>
      <div>Combined net available: ${totalNet.toLocaleString()}</div>
    </div>
  `;
}

function siteIcon(): L.DivIcon {
  return L.divIcon({
    className: "site-pin-icon",
    html:
      '<div style="width:16px;height:16px;border-radius:50%;' +
      "background:#dc2626;border:2px solid #7f1d1d;" +
      'box-shadow:0 1px 3px rgba(0,0,0,0.45);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export default function SiteMapGlobalPage() {
  const {
    selectedCountries,
    country,
    setCountry,
    data,
    loading,
    error,
    allSites,
    radiusMiles,
    setRadiusMiles,
  } = useIndependentSiteSearch();
  const { regionOptions } = usePipeline();
  // When the trial form has no region/country pre-selected (the NCT-lookup
  // flow deliberately leaves this empty to search every region globally),
  // fall back to every country this app is configured to search at all,
  // rather than showing a permanently-disabled "no region selected"
  // dropdown even though a real, global map is already loaded below.
  const fallbackCountryOptions = allConfiguredCountries(regionOptions);
  // Local to this page only — Site Map Details no longer shares state with
  // this page (each of the 3 Site Map pages now has its own independent
  // country/site data, per request), so there's nothing else to sync a
  // clicked pin's selection with.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Map filter bar (redesign spec item 10 — "Make the Map More Useful"):
  // client-side filters over whatever the current search already returned,
  // so narrowing the view never requires a fresh network round-trip.
  const [showFilter, setShowFilter] = useState<"all" | "top10">("all");
  const [riskFilter, setRiskFilter] = useState<"All" | "Low" | "Medium" | "High">(
    "All",
  );
  const [patientsFilter, setPatientsFilter] = useState<"All" | "100" | "250" | "500">(
    "All",
  );

  const filteredSites = useMemo(() => {
    let list = allSites;
    if (riskFilter !== "All") {
      list = list.filter((s) => s.riskLevel === riskFilter);
    }
    if (patientsFilter !== "All") {
      const threshold = Number(patientsFilter);
      list = list.filter((s) => s.netAvailablePatients >= threshold);
    }
    if (showFilter === "top10") {
      list = [...list]
        .sort((a, b) => b.netAvailablePatients - a.netAvailablePatients)
        .slice(0, 10);
    }
    return list;
  }, [allSites, riskFilter, patientsFilter, showFilter]);

  // Clear a selection (and whatever preview/radius ring it drove) the
  // moment a filter change makes that site disappear from the map, rather
  // than leaving a stale preview card open for a pin that's no longer shown.
  useEffect(() => {
    if (selectedSiteId && !filteredSites.some((s) => s.siteId === selectedSiteId)) {
      setSelectedSiteId(null);
    }
  }, [filteredSites, selectedSiteId]);

  const selectedSite = selectedSiteId
    ? (allSites.find((s) => s.siteId === selectedSiteId) ?? null)
    : null;

  function closePreview() {
    const marker = selectedSiteId ? markerByIdRef.current.get(selectedSiteId) : null;
    marker?.closePopup();
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    setSelectedSiteId(null);
  }

  const [isFullScreen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
    }
  }, [isFullScreen]);

  function showRadiusRing(site: MapSiteRow) {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    radiusCircleRef.current = L.circle([site.lat, site.lng], {
      radius: radiusMiles * MILES_TO_METERS,
      color: "#dc2626",
      weight: 1.5,
      dashArray: "6 6",
      fillColor: "#dc2626",
      fillOpacity: 0.08,
    }).addTo(map);
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: WORLD_CENTER,
      zoom: WORLD_ZOOM,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
    });
    L.tileLayer(OSM_TILE_URL, {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
      attribution: OSM_ATTRIBUTION,
    }).addTo(map);
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
    });
    clusterGroup.addTo(map);
    
    clusterGroup.on("clustermouseover", (e: any) => {
      const cluster = e.layer;
      const sites: MapSiteRow[] = cluster
        .getAllChildMarkers()
        .map((m: any) => m.__siteData)
        .filter(Boolean);
      if (sites.length === 0) return;
      cluster.bindTooltip(buildClusterTooltipHtml(sites), {
        direction: "top",
        offset: [0, -10],
      });
      cluster.openTooltip();
    });
    mapInstanceRef.current = map;
    clusterGroupRef.current = clusterGroup;
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      clusterGroupRef.current = null;
      radiusCircleRef.current = null;
      markerByIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;
    clusterGroup.clearLayers();
    markerByIdRef.current.clear();
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    const latLngs: [number, number][] = [];
    for (const s of filteredSites) {
      const marker = L.marker([s.lat, s.lng], { icon: siteIcon() });
      marker.bindPopup(buildPopupHtml(s, SITE_MAP_METRIC), { maxWidth: 280 });
      marker.bindTooltip(buildMarkerTooltipHtml(s), {
        direction: "top",
        offset: [0, -10],
      });
      (marker as any).__siteData = s;
      // Opens the in-place Site Preview Card below (state only — no route
      // change), on top of Leaflet's own popup. Per redesign spec item 10,
      // clicking a marker must never navigate the user away from the map.
      marker.on("click", () => setSelectedSiteId(s.siteId));
      clusterGroup.addLayer(marker);
      markerByIdRef.current.set(s.siteId, marker);
      latLngs.push([s.lat, s.lng]);
    }
    map.invalidateSize();
    if (latLngs.length > 0) {
      map.fitBounds(L.latLngBounds(latLngs), {
        padding: [40, 40],
        maxZoom: 10,
      });
    } else {
      map.setView(WORLD_CENTER, WORLD_ZOOM);
    }
  }, [filteredSites]);

  useEffect(() => {
    if (!selectedSiteId) return;
    const clusterGroup = clusterGroupRef.current;
    const marker = markerByIdRef.current.get(selectedSiteId);
    const site = filteredSites.find((s) => s.siteId === selectedSiteId);
    if (!clusterGroup || !marker || !site) return;
    showRadiusRing(site);
    clusterGroup.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
  }, [selectedSiteId, filteredSites]);

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
              options={selectedCountries.map((c) => ({ value: c, label: c }))}
            />
          ) : (
            <>
              <Select
                value={country}
                onChange={setCountry}
                disabled={loading}
                options={[
                  { value: "", label: "All countries" },
                  ...fallbackCountryOptions.map((c) => ({ value: c, label: c })),
                ]}
              />
              <span className="map-field-note">
                No region selected in Step 1 — showing sites across every
                region. Pick a country above to narrow it.
              </span>
            </>
          )}
        </label>
        

        {/* Compact inline notice next to the button instead of a large
            dashed placeholder box taking up the whole panel below. */}
        {!data && !loading && !error && (
          <span className="map-no-search-note">
            No search yet — hit Search to plot sites.
          </span>
        )}
      </div>

      {data && allSites.length > 0 && (
        <div className="map-filter-bar">
          <div className="map-filter-group">
            <span className="map-filter-group-label">Show</span>
            <div className="map-filter-pills">
              <button
                type="button"
                className={`map-filter-pill${showFilter === "all" ? " active" : ""}`}
                onClick={() => setShowFilter("all")}
              >
                All Sites
              </button>
              <button
                type="button"
                className={`map-filter-pill${showFilter === "top10" ? " active" : ""}`}
                onClick={() => setShowFilter("top10")}
                data-tooltip="Top 10 by net available patients"
              >
                Top 10
              </button>
            </div>
          </div>

          <div className="map-filter-group">
            <span className="map-filter-group-label">Risk</span>
            <div className="map-filter-pills">
              {(["All", "Low", "Medium", "High"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`map-filter-pill${riskFilter === level ? " active" : ""}`}
                  onClick={() => setRiskFilter(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="map-filter-group">
            <span className="map-filter-group-label">Patients</span>
            <div className="map-filter-pills">
              {(["All", "100", "250", "500"] as const).map((threshold) => (
                <button
                  key={threshold}
                  type="button"
                  className={`map-filter-pill${patientsFilter === threshold ? " active" : ""}`}
                  onClick={() => setPatientsFilter(threshold)}
                  data-tooltip={threshold === "All" ? undefined : `${threshold}+ net available patients`}
                >
                  {threshold === "All" ? "All" : `${threshold}+`}
                </button>
              ))}
            </div>
          </div>

          <div className="map-filter-group">
            <span className="map-filter-group-label">Catchment</span>
            <div className="map-filter-pills">
              {[5, 25, 50].map((miles) => (
                <button
                  key={miles}
                  type="button"
                  className={`map-filter-pill${radiusMiles === miles ? " active" : ""}`}
                  onClick={() => setRadiusMiles(miles)}
                  disabled={loading}
                  data-tooltip={`Re-run the search with a ${miles}-mile catchment radius`}
                >
                  {miles} mi
                </button>
              ))}
            </div>
          </div>

          <span className="map-filter-count">
            {filteredSites.length} of {allSites.length} site(s) shown
          </span>
        </div>
      )}

      <div className="card-scroll-body">
        {error && <p className="error-text">{error}</p>}

        {/* Always visible (not conditionally hidden) — creating the Leaflet
            map while its container is display:none leaves Leaflet with a
            stale/zero size it never recovers from on its own. The loading
            spinner overlays this same box (centered over the map itself)
            instead of sitting in its own space above it, so it doesn't
            leave a tall, mostly-empty gap between the toolbar and the map
            while a search is in flight. */}
        <div style={{ marginTop: 14, position: "relative" }}>
          {loading && (
            <div className="map-loading-overlay">
              <StageLoader label="Loading site map…" />
            </div>
          )}
          <div
            ref={mapContainerRef}
            style={{
              width: "100%",
              height: 480,
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          />

          <div className="map-legend">
            <span>
              <i
                style={{
                  background: "var(--danger)",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              />{" "}
              Single site — click for details
            </span>
            <span>
              <i
                style={{
                  background: "rgba(110, 204, 57, 0.85)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid var(--card)",
                  boxShadow: "0 0 0 1px #cfe6bb",
                  display: "inline-block",
                }}
              />{" "}
              Small cluster (under 10 sites) — click to zoom in
            </span>
            <span>
              <i
                style={{
                  background: "rgba(240, 194, 12, 0.85)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid var(--card)",
                  boxShadow: "0 0 0 1px #f0dca0",
                  display: "inline-block",
                }}
              />{" "}
              Medium cluster (10+ sites) — click to zoom in
            </span>
            <span>
              <i
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "1.5px dashed #dc2626",
                  background: "rgba(220, 38, 38, 0.08)",
                }}
              />{" "}
              {radiusMiles}-mile catchment — shown when you click a
              site
            </span>
          </div>
        </div>

        {/* In-place Site Preview Card (redesign spec item 10): clicking a
            marker sets selectedSiteId and shows this instead of navigating
            anywhere else, so the map's pan/zoom/filter context is never
            lost. Sits alongside Leaflet's own popup rather than replacing
            it, since the popup is still useful while zoomed in. */}
        {selectedSite && (
          <div className="site-preview-card">
            <div className="site-preview-card-head">
              <div>
                <div className="site-preview-card-name">{selectedSite.siteName}</div>
                <div className="site-preview-card-location">
                  {[selectedSite.city, selectedSite.state, selectedSite.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </div>
              <button
                type="button"
                className="site-preview-card-close"
                onClick={closePreview}
                aria-label="Close site preview"
              >
                ×
              </button>
            </div>
            <div className="site-preview-card-stats">
              <div>
                <div className="site-preview-card-stat-k">Net Available</div>
                <div className="site-preview-card-stat-v">
                  {selectedSite.netAvailablePatients.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="site-preview-card-stat-k">Gross Eligible</div>
                <div className="site-preview-card-stat-v">
                  {selectedSite.grossEligiblePatients.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="site-preview-card-stat-k">Risk</div>
                <div className="site-preview-card-stat-v">
                  <span className={`badge ${selectedSite.riskLevel.toLowerCase()}`}>
                    {selectedSite.riskScore !== null ? `${selectedSite.riskScore}/100` : "N/A"}
                  </span>
                </div>
              </div>
              <div>
                <div className="site-preview-card-stat-k">Status</div>
                <div className="site-preview-card-stat-v">
                  {selectedSite.status ?? "Unknown"}
                </div>
              </div>
            </div>
          </div>
        )}

        {data && allSites.length === 0 && !error && (
          <EmptyState icon="🔍" title="No live sites found" detail="Try a different country or adjust your search." />
        )}
      </div>
      <WizardNextLink />
    </div>
  );
}