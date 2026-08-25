import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { MapSiteRow } from "../../types";
import { useIndependentSiteSearch } from "../../hooks/useIndependentSiteSearch";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import EmptyState from "../ui/EmptyState";
import {
  MILES_TO_METERS,
  SITE_MAP_METRIC,
  SITE_MAP_RADIUS_MILES,
  catchmentDistanceLabel,
  coordsSourceLabel,
  escapeHtml,
  segmentsLine,
} from "../../utils/siteMapFormat";

const WORLD_CENTER: [number, number] = [20, 0];
const WORLD_ZOOM = 2;

// A real Google-Maps-style map: OpenStreetMap's free raster tile server —
// no API key, no billing account, no card required (same "free tier"
// philosophy as the Nominatim geocoding elsewhere in this app). Usage
// policy requires the attribution below and asks apps not to hammer it
// with heavy traffic; fine for this app's per-search tile loads.
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// Popup content for a site's map pin — built as an HTML string for
// Leaflet's imperative popup API. All external/LLM-sourced text
// (site name, rationale, city/state/country) is escaped before insertion.
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

// Lightweight hover tooltip for a single site's pin — shorter than the
// click popup (buildPopupHtml), just enough to orient without clicking:
// name, location, and the patient-catchment numbers. There's no real
// "registered for trial" count anywhere in this data — these are the same
// estimated Gross Eligible / Net Available figures shown in the table and
// popup (see liveMapData.ts for what's synthetic/estimated vs. live).
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

// Hover tooltip for a cluster bubble (the green/orange/yellow circles) —
// summarizes the sites bundled inside it rather than making the user click
// to expand/zoom just to see what's there.
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

// Plain red pin (Google-Maps-style), built as inline-styled HTML rather
// than an external icon image or CSS class — Leaflet's default marker
// icon depends on image assets that are easy to lose track of through a
// bundler, and an inline-styled divIcon can't break that way.
function siteIcon(): L.DivIcon {
  return L.divIcon({
    className: "site-pin-icon",
    html:
      '<div style="width:16px;height:16px;border-radius:50%;' +
      "background:#e5342b;border:2px solid #7a0f0f;" +
      'box-shadow:0 1px 3px rgba(0,0,0,0.45);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

export default function SiteMapGlobalPage() {
  const {
    indication,
    selectedCountries,
    country,
    setCountry,
    data,
    loading,
    error,
    allSites,
  } = useIndependentSiteSearch();
  // Local to this page only — Site Map Details no longer shares state with
  // this page (each of the 3 Site Map pages now has its own independent
  // country/site data, per request), so there's nothing else to sync a
  // clicked pin's selection with.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  // leaflet.markercluster augments the Leaflet namespace at runtime; typed
  // loosely here rather than depending on the exact @types/leaflet.markercluster
  // augmentation shape.
  const clusterGroupRef = useRef<any>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());

  function showRadiusRing(site: MapSiteRow) {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    radiusCircleRef.current = L.circle([site.lat, site.lng], {
      radius: SITE_MAP_RADIUS_MILES * MILES_TO_METERS,
      color: "#d92b2b",
      weight: 1.5,
      dashArray: "6 6",
      fillColor: "#d92b2b",
      fillOpacity: 0.08,
    }).addTo(map);
  }

  // Create the Leaflet map once on mount and tear it down on unmount.
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
    // leaflet.markercluster builds/tears down cluster bubbles on the fly as
    // you zoom, so there's no fixed list of "cluster markers" to attach a
    // tooltip to up front — instead we (re)bind fresh content onto whatever
    // cluster the mouse is currently over, standard practice for this
    // plugin (mirrors its own README's `clustermouseover`-bound-popup
    // example, just with a hover tooltip instead of a click popup).
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

  // Rebuild pins whenever the filtered site list changes (a new search, or
  // the search box narrowing results, set on the Site Map Details page) and
  // fit the view around them — a country-scoped search zooms to that
  // country automatically instead of always showing the whole world.
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
    for (const s of allSites) {
      const marker = L.marker([s.lat, s.lng], { icon: siteIcon() });
      marker.bindPopup(buildPopupHtml(s, SITE_MAP_METRIC), { maxWidth: 280 });
      marker.bindTooltip(buildMarkerTooltipHtml(s), {
        direction: "top",
        offset: [0, -10],
      });
      // Stashed so the cluster-hover handler above can summarize whichever
      // sites happen to be bundled into a given bubble at the current zoom.
      (marker as any).__siteData = s;
      marker.on("click", () => setSelectedSiteId(s.siteId));
      clusterGroup.addLayer(marker);
      markerByIdRef.current.set(s.siteId, marker);
      latLngs.push([s.lat, s.lng]);
    }
    // The container is created while still effectively hidden (0-height,
    // before any search result exists), so Leaflet's cached size is stale
    // by the time real data arrives — invalidateSize() forces it to
    // re-measure before we ask it to fit/frame anything.
    map.invalidateSize();
    if (latLngs.length > 0) {
      map.fitBounds(L.latLngBounds(latLngs), {
        padding: [40, 40],
        maxZoom: 10,
      });
    } else {
      map.setView(WORLD_CENTER, WORLD_ZOOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSites]);

  // Focus whichever site is selected — whether that selection came from a
  // pin click here, or a table-row click on the Site Map Details page.
  // Keeps the two pages' selection in sync without duplicating the
  // zoom/circle logic in both places.
  useEffect(() => {
    if (!selectedSiteId) return;
    const clusterGroup = clusterGroupRef.current;
    const marker = markerByIdRef.current.get(selectedSiteId);
    const site = allSites.find((s) => s.siteId === selectedSiteId);
    if (!clusterGroup || !marker || !site) return;
    showRadiusRing(site);
    clusterGroup.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, allSites]);

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
        {/* Compact inline notice instead of a large dashed placeholder box
            taking up the whole panel below — the search itself now runs
            automatically (see useIndependentSiteSearch) as soon as an
            indication/country resolve, so there's no button to prompt. */}
        {!data && !loading && !error && (
          <span className="map-no-search-note">
            {indication ? "Loading sites…" : "Pick an indication to plot sites."}
          </span>
        )}
      </div>

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
              border: "1px solid #d7dbe6",
            }}
          />

          <div className="map-legend">
            <span>
              <i
                style={{
                  background: "#e5342b",
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
                  border: "2px solid #fff",
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
                  border: "2px solid #fff",
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
                  border: "1.5px dashed #d92b2b",
                  background: "rgba(217,43,43,0.08)",
                }}
              />{" "}
              {SITE_MAP_RADIUS_MILES}-mile catchment — shown when you click a
              site
            </span>
          </div>
        </div>

        {data && allSites.length === 0 && !error && (
          <EmptyState icon="🔍" title="No live sites found" detail="Try a different country or adjust your search." />
        )}
      </div>
      <WizardNextLink />
    </div>
  );
}
