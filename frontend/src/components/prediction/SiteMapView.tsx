import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type {
  CombinedCatchmentResponse,
  EligibilityFilterSetResponse,
  LiveMapResponse,
  MapSiteRow,
} from "../../types";
import { fetchCombinedCatchment, fetchLiveSiteMap } from "../../services/map.service";
import { fetchEligibilityFilters } from "../../services/eligibilityFilters.service";
import SiteCombinationPlanner from "./SiteCombinationPlanner";

const WORLD_CENTER: [number, number] = [20, 0];
const WORLD_ZOOM = 2;
const MILES_TO_METERS = 1609.34;

// A real Google-Maps-style map: OpenStreetMap's free raster tile server —
// no API key, no billing account, no card required (same "free tier"
// philosophy as the Nominatim geocoding elsewhere in this app). Usage
// policy requires the attribution below and asks apps not to hammer it
// with heavy traffic; fine for this app's per-search tile loads.
const OSM_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coordsSourceLabel(source: MapSiteRow["coordsSource"]): string {
  if (source === "approximate") return "approximate";
  if (source === "live-nominatim") return "geocoded (OpenStreetMap)";
  return "geocoded (Google)";
}

function catchmentDistanceLabel(source: MapSiteRow["catchmentDistanceSource"]): string {
  switch (source) {
    case "live-google":
      return "real driving distance (Google)";
    case "live-osrm":
      return "real driving distance (OSRM)";
    case "mixed":
      return "mix of real driving distance and straight-line";
    case "approximate-haversine":
      return "straight-line distance (no driving-distance data)";
    default:
      return "n/a";
  }
}

function segmentsLine(s: MapSiteRow): string {
  if (!s.patientSegments) return "";
  const seg = s.patientSegments;
  return (
    `Newly diagnosed: ${seg.newlyDiagnosed.toLocaleString()} · ` +
    `Non-responder: ${seg.nonResponder.toLocaleString()} · ` +
    `Stable: ${seg.stableOnTreatment.toLocaleString()} (illustrative split)`
  );
}

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

// Derives the badge color band directly from the numeric score, instead of
// trusting the LLM's separately-estimated riskLevel label — the model
// doesn't enforce a strict number-to-label mapping, so two sites can get
// the identical score with different labels (e.g. two "35/100" sites, one
// tagged Low and the other Medium). This guarantees the same number always
// renders the same color.
function riskBand(score: number | null): "low" | "medium" | "high" | "unknown" {
  if (score === null) return "unknown";
  if (score < 34) return "low";
  if (score < 67) return "medium";
  return "high";
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

type SortKey = "site" | "location" | "gross" | "net" | "risk";

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sitesToCsv(sites: MapSiteRow[]): string {
  const header = [
    "Site",
    "City",
    "State",
    "Country",
    "Gross Eligible Patients",
    "Already Enrolled Patients",
    "Net Available Patients",
    "Assumed Consent/Conversion Rate (%)",
    "Expected Recruitment",
    "Newly Diagnosed (illustrative)",
    "Non-Responder (illustrative)",
    "Stable On Treatment (illustrative)",
    "Risk Level",
    "Risk Score",
    "Coordinates Source",
    "Catchment Distance Source",
  ];
  const rows = sites.map((s) => [
    s.siteName,
    s.city ?? "",
    s.state ?? "",
    s.country ?? "",
    s.grossEligiblePatients,
    s.alreadyEnrolledPatients,
    s.netAvailablePatients,
    Math.round(s.assumedConsentRate * 1000) / 10,
    Math.round(s.netAvailablePatients * s.assumedConsentRate),
    s.patientSegments?.newlyDiagnosed ?? "",
    s.patientSegments?.nonResponder ?? "",
    s.patientSegments?.stableOnTreatment ?? "",
    s.riskLevel,
    s.riskScore ?? "",
    s.coordsSource,
    s.catchmentDistanceSource,
  ]);
  return [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * "Site Map (Global)" tab — real ClinicalTrials.gov site locations for an
 * indication, worldwide, plotted on an actual live map (OpenStreetMap
 * tiles via Leaflet — real streets, place names, and geography, not a
 * hand-drawn outline), with an estimated patient catchment and an
 * LLM-estimated risk score per site. Sites cluster automatically as you
 * zoom out and split apart as you zoom in (via leaflet.markercluster);
 * clicking a pin or a table row opens that site's details and draws its
 * actual N-mile catchment radius as a dashed circle. Also supports a
 * search filter, sortable results columns, and CSV export.
 *
 * See the caveats paragraph at the bottom of this component (and
 * pipeline/liveMapData.ts on the backend) for exactly what's live vs.
 * synthetic vs. approximate: the map tiles and site coordinates are real
 * (geocoded live via Google, or the free OpenStreetMap fallback), but
 * patient population figures are a synthetic dataset — no live public
 * source publishes real population by postal area for arbitrary
 * countries.
 */
export default function SiteMapView({
  indication,
  selectedCountries = [],
}: {
  indication: string;
  /** Countries pulled from the trial form's already-selected regions — sources the country dropdown below instead of free-text entry. Empty = no region picked yet, so only "All countries" is offered. */
  selectedCountries?: string[];
}) {
  const [country, setCountry] = useState("");
  // Radius and gross-vs-net were previously user-adjustable controls; kept
  // as fixed values now that those controls are removed from the UI —
  // everything downstream (search params, the radius ring, popup/tooltip
  // wording) still reads from these two constants.
  const radiusMiles = 50;
  const metric: "gross" | "net" = "net";
  const [data, setData] = useState<LiveMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("net");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Checked rows for the "combined catchment" comparison below the table —
  // separate from selectedSiteId (which just focuses one site on the map).
  // See fetchCombinedCatchment: this answers "if I picked these sites
  // together, how many UNIQUE patients could I actually reach" instead of
  // wrongly summing each site's own (independently-computed) number.
  const [combineIds, setCombineIds] = useState<Set<string>>(new Set());
  const [combineResult, setCombineResult] = useState<CombinedCatchmentResponse | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);

  // Inclusion/exclusion-criteria filter dropdown on the "Net Available"
  // column — Srikanth's ask, made interactive: real disclosed eligibility
  // criteria, each with an LLM-estimated "% of the general indication
  // population this criterion alone would exclude" (see backend
  // pipeline/eligibilityFilters.ts). Toggling checkboxes recomputes an
  // illustrative adjusted Net Available figure client-side — this is a
  // simplification (criteria are assumed independent, which real ones
  // rarely are) layered on top of an already-synthetic base population, so
  // it is always labeled illustrative, never shown as the "real" number.
  const [eligFilters, setEligFilters] = useState<EligibilityFilterSetResponse | null>(null);
  const [eligFiltersLoading, setEligFiltersLoading] = useState(false);
  const [eligFiltersError, setEligFiltersError] = useState<string | null>(null);
  const [selectedFilterIds, setSelectedFilterIds] = useState<Set<string>>(new Set());
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Requirement #1 ("Eliminate Patients Already Enrolled in Another Trial"):
  // checked (default) = Net Available column shows netAvailablePatients,
  // i.e. eligible patients MINUS an estimated already-enrolled-elsewhere
  // share. Unchecked = shows grossEligiblePatients instead, i.e. eligible
  // patients INCLUDING those already enrolled elsewhere — lets a stakeholder
  // compare the strict recruitment scenario against the total eligible pool.
  const [excludeEnrolled, setExcludeEnrolled] = useState(true);

  useEffect(() => {
    if (!indication) {
      setEligFilters(null);
      return;
    }
    setEligFiltersLoading(true);
    setEligFiltersError(null);
    setSelectedFilterIds(new Set());
    fetchEligibilityFilters(indication)
      .then(setEligFilters)
      .catch((err) => {
        setEligFiltersError((err as Error).message);
        setEligFilters(null);
      })
      .finally(() => setEligFiltersLoading(false));
  }, [indication]);

  function toggleEligFilter(id: string) {
    setSelectedFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilterIds = eligFilters?.filters.map((f) => f.id) ?? [];
  const allFiltersSelected =
    allFilterIds.length > 0 && allFilterIds.every((id) => selectedFilterIds.has(id));

  function toggleSelectAllFilters() {
    setSelectedFilterIds(allFiltersSelected ? new Set() : new Set(allFilterIds));
  }

  const activeEligFilters = useMemo(
    () => (eligFilters?.filters ?? []).filter((f) => selectedFilterIds.has(f.id)),
    [eligFilters, selectedFilterIds],
  );

  // Compounds each selected filter's estimated retained fraction
  // (1 - excluded%) together — an illustrative simplification that treats
  // criteria as independent; real eligibility criteria overlap (e.g. a
  // patient excluded for age is often also excluded for a related lab
  // value), so this is a reasonable upper bound on the true adjusted count,
  // not a precise joint estimate.
  const combinedRetainFraction = useMemo(
    () =>
      activeEligFilters.reduce(
        (acc, f) => acc * (1 - f.estimatedExcludedPercent / 100),
        1,
      ),
    [activeEligFilters],
  );

  /** netAvailablePatients when excludeEnrolled is checked (the strict, "available now" scenario), or grossEligiblePatients (available + already enrolled) when unchecked. */
  function baseAvailable(site: MapSiteRow): number {
    return excludeEnrolled ? site.netAvailablePatients : site.grossEligiblePatients;
  }

  function adjustedNetAvailable(site: MapSiteRow): number {
    const base = baseAvailable(site);
    if (activeEligFilters.length === 0) return base;
    return Math.max(0, Math.round(base * combinedRetainFraction));
  }

  /**
   * "Eligible patients ≠ enrolled patients" (100 eligible ≠ 100 enrolled):
   * applies this site's own assumed consent/conversion rate to whatever's
   * currently shown in the Available column (already reflecting the
   * excludeEnrolled toggle and any active eligibility filters above), rather
   * than treating the whole available population as recruitable. The rate
   * itself is a per-site SYNTHETIC figure (data/syntheticSiteCost.ts's
   * syntheticConsentRateFor on the backend) — no live or LLM source
   * discloses a real per-site screening-to-enrollment conversion rate.
   */
  function expectedRecruitment(site: MapSiteRow): number {
    return Math.max(
      0,
      Math.round(adjustedNetAvailable(site) * site.assumedConsentRate),
    );
  }

  function toggleCombine(siteId: string) {
    setCombineResult(null);
    setCombineError(null);
    setCombineIds((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  async function computeCombined() {
    const chosen = allSites.filter((s) => combineIds.has(s.siteId));
    if (chosen.length < 2 || !data) return;
    setCombineLoading(true);
    setCombineError(null);
    try {
      const res = await fetchCombinedCatchment({
        indication,
        country: chosen[0].country,
        radiusMiles,
        sites: chosen.map((s) => ({
          siteId: s.siteId,
          lat: s.lat,
          lng: s.lng,
          netAvailablePatients: s.netAvailablePatients,
        })),
      });
      setCombineResult(res);
    } catch (err) {
      setCombineError((err as Error).message);
      setCombineResult(null);
    } finally {
      setCombineLoading(false);
    }
  }

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  // leaflet.markercluster augments the Leaflet namespace at runtime; typed
  // loosely here rather than depending on the exact @types/leaflet.markercluster
  // augmentation shape.
  const clusterGroupRef = useRef<any>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());

  // The dropdown only ever offers the countries actually selected for this
  // trial — manually, or via "Use this region"/"Use" on an AI region
  // prediction (that action writes straight into form.regions, which is
  // where selectedCountries comes from, so an applied AI pick shows up here
  // automatically). Keep `country` in sync whenever that list changes:
  // default to the first selected country, or clear it if nothing is
  // selected (falls back to a global search) or the current pick fell out
  // of the list.
  useEffect(() => {
    if (selectedCountries.length === 0) {
      if (country) setCountry("");
    } else if (!selectedCountries.includes(country)) {
      setCountry(selectedCountries[0]);
    }
  }, [selectedCountries, country]);

  // Auto-run the first search as soon as this tab opens, instead of
  // requiring an extra manual click every time — but only once the country
  // dropdown has settled on its real value (if selectedCountries is
  // non-empty, `country` starts at "" for one render before the effect
  // above sets it; searching during that transient render would run an
  // unwanted global search instead of the intended country-scoped one).
  const autoSearchedRef = useRef(false);
  const countryResolved = selectedCountries.length === 0 || country !== "";
  useEffect(() => {
    if (autoSearchedRef.current || !indication || !countryResolved) return;
    autoSearchedRef.current = true;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indication, countryResolved]);

  async function runSearch() {
    if (!indication) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLiveSiteMap({
        indication,
        country: country || undefined,
        radiusMiles,
      });
      setData(res);
      setSelectedSiteId(null);
      setSearch("");
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const allSites = data?.sites ?? [];

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSites;
    return allSites.filter((s) =>
      [s.siteName, s.city, s.state, s.country]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [allSites, search]);

  const sortedSites = useMemo(() => {
    const copy = [...filteredSites];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case "site":
          return a.siteName.localeCompare(b.siteName) * dir;
        case "location": {
          const la = [a.city, a.state, a.country].filter(Boolean).join(", ");
          const lb = [b.city, b.state, b.country].filter(Boolean).join(", ");
          return la.localeCompare(lb) * dir;
        }
        case "gross":
          return (a.grossEligiblePatients - b.grossEligiblePatients) * dir;
        case "risk":
          return ((a.riskScore ?? -1) - (b.riskScore ?? -1)) * dir;
        case "net":
        default:
          return (a.netAvailablePatients - b.netAvailablePatients) * dir;
      }
    });
    return copy;
  }, [filteredSites, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortArrow(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

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

  function showRadiusRing(site: MapSiteRow) {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    radiusCircleRef.current = L.circle([site.lat, site.lng], {
      radius: radiusMiles * MILES_TO_METERS,
      color: "#d92b2b",
      weight: 1.5,
      dashArray: "6 6",
      fillColor: "#d92b2b",
      fillOpacity: 0.08,
    }).addTo(map);
  }

  // Clicking a table row should focus that site on the map even if it's
  // currently hidden inside a collapsed cluster — zoomToShowLayer (from
  // leaflet.markercluster) zooms in just enough to reveal it before we
  // open its popup, rather than silently doing nothing.
  function focusSite(site: MapSiteRow) {
    const clusterGroup = clusterGroupRef.current;
    const marker = markerByIdRef.current.get(site.siteId);
    if (!clusterGroup || !marker) return;
    setSelectedSiteId(site.siteId);
    showRadiusRing(site);
    clusterGroup.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });
  }

  // Create the Leaflet map once on mount and tear it down on unmount. This
  // component is only ever rendered while its tab is active (the parent
  // swaps it in/out via a ternary), so a fresh mount always has a
  // correctly-sized container to attach to.
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
  // the search box narrowing results) and fit the view around them — a
  // country-scoped search zooms to that country automatically instead of
  // always showing the whole world.
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
      marker.bindPopup(buildPopupHtml(s, metric), { maxWidth: 280 });
      marker.bindTooltip(buildMarkerTooltipHtml(s), {
        direction: "top",
        offset: [0, -10],
      });
      // Stashed so the cluster-hover handler above can summarize whichever
      // sites happen to be bundled into a given bubble at the current zoom.
      (marker as any).__siteData = s;
      marker.on("click", () => {
        setSelectedSiteId(s.siteId);
        showRadiusRing(s);
      });
      clusterGroup.addLayer(marker);
      markerByIdRef.current.set(s.siteId, marker);
      latLngs.push([s.lat, s.lng]);
    }
    // The container is created while still effectively hidden (0-height,
    // before any search result exists), so Leaflet's cached size is stale
    // by the time real data arrives — invalidateSize() forces it to
    // re-measure before we ask it to fit/frame anything. Without this the
    // map renders mostly blank/gray except for whatever tiles it guessed
    // at with the wrong container size.
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
  }, [filteredSites]);

  // Refresh popup content (which metric is bolded) without rebuilding
  // markers or re-fitting the view — toggling gross/net shouldn't re-zoom
  // the map every time.
  useEffect(() => {
    for (const s of filteredSites) {
      const marker = markerByIdRef.current.get(s.siteId);
      if (marker) marker.setPopupContent(buildPopupHtml(s, metric));
    }
  }, [metric, filteredSites]);

  return (
    <>
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="predict-title">Site Map (Global)</span>
          </div>
          <div className="predict-head-actions">
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
        <p className="section-hint">
          Real ClinicalTrials.gov site locations for{" "}
          {indication || "the selected indication"}, worldwide, with an
          estimated patient catchment and risk score per site.
        </p>
      </div>

      <div className="map-controls">
        <label
          className="map-field"
          title="Sourced from the region(s) already selected for this trial — either picked manually in Step 1, or applied from an AI region prediction."
        >
          <span>Country</span>
          {selectedCountries.length > 0 ? (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {selectedCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select value="" disabled>
                <option value="">All countries</option>
              </select>
              <span className="map-field-note">
                No region selected yet — pick one in Step 1 (or apply an AI
                prediction) to narrow this.
              </span>
            </>
          )}
        </label>
      </div>

      <div className="card-scroll-body">
        {error && <p className="error-text">{error}</p>}

        {!data && !loading && !error && (
          <p className="predict-placeholder">
            No search yet — hit Search to plot real trial sites for this
            indication worldwide, without changing your left-hand filters.
          </p>
        )}

        {data && data.warnings.length > 0 && (
          <div className="map-warnings">
            {data.warnings.map((w, i) => (
              <p key={i} className="warning-text">
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Always visible (not conditionally hidden) — creating the Leaflet
            map while its container is display:none leaves Leaflet with a
            stale/zero size it never recovers from on its own, which is
            what caused the mostly-blank/gray map. Showing the world by
            default here also matches a real map being present immediately,
            the same way Google Maps always shows something. */}
        <div style={{ marginTop: 14 }}>
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
              {radiusMiles}-mile catchment — shown when you click a site
            </span>
            <span className="map-legend-note">
              Cluster color/number is just a count of nearby sites — risk score
              is shown in the table below and in each site's popup
            </span>
          </div>
        </div>

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
                    <th
                      className="sortable"
                      onClick={() => toggleSort("location")}
                    >
                      Location{sortArrow("location")}
                    </th>
                    <th
                      className="sortable"
                      onClick={() => toggleSort("gross")}
                    >
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
                                  onClick={() => setSelectedFilterIds(new Set())}
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
                    <th
                      title="Available x this site's own synthetic consent/conversion rate — 100 eligible patients doesn't mean 100 enrolled"
                    >
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
                      className={
                        selectedSiteId === s.siteId ? "pinned-row" : ""
                      }
                      onClick={() => focusSite(s)}
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
                        <span
                          style={{ display: "block", fontSize: 11, color: "#888" }}
                        >
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

            {(() => {
              const sampleSite = allSites.find((s) => s.siteId === selectedSiteId);
              return (
                <details className="card" style={{ marginTop: 12, padding: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                    View sample patients{sampleSite ? ` — ${sampleSite.siteName}` : ""}
                  </summary>
                  {!sampleSite && (
                    <p className="section-hint" style={{ marginTop: 8 }}>
                      Click a site row above to view a sample of its
                      synthetic, patient-level records.
                    </p>
                  )}
                  {sampleSite && (
                    <>
                      <p className="section-hint" style={{ marginTop: 8 }}>
                        Requirement #4 demonstration: {sampleSite.patientSample.length}{" "}
                        illustrative synthetic patient records for {sampleSite.siteName}
                        . "Trial Status" is fabricated in the same Available/
                        Enrolled ratio as this site's real Already
                        Enrolled/Available counts above — not real patient
                        data.
                      </p>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Patient ID</th>
                              <th>Disease</th>
                              <th>Age</th>
                              <th>Kidney Disease</th>
                              <th>Liver Disease</th>
                              <th>Heart Disease</th>
                              <th>Diabetes</th>
                              <th>Trial Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sampleSite.patientSample.map((p) => (
                              <tr key={p.patientId}>
                                <td>{p.patientId}</td>
                                <td>{p.disease}</td>
                                <td>{p.age}</td>
                                <td>{p.kidneyDisease ? "Yes" : "No"}</td>
                                <td>{p.liverDisease ? "Yes" : "No"}</td>
                                <td>{p.heartDisease ? "Yes" : "No"}</td>
                                <td>{p.diabetes ? "Yes" : "No"}</td>
                                <td>
                                  <span
                                    className={`badge ${p.trialStatus === "Available" ? "low" : "medium"}`}
                                  >
                                    {p.trialStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </details>
              );
            })()}

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
                    onClick={() => {
                      setCombineIds(new Set());
                      setCombineResult(null);
                      setCombineError(null);
                    }}
                  >
                    Clear
                  </button>
                </div>
                {combineIds.size < 2 && (
                  <p className="section-hint">
                    Select at least one more site to compare.
                  </p>
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
                {combineResult && combineResult.warnings.map((w, i) => (
                  <p key={i} className="warning-text">
                    {w}
                  </p>
                ))}
              </div>
            )}

            {country && (
              <SiteCombinationPlanner
                indication={indication}
                country={country}
                sites={allSites}
              />
            )}

            <p className="map-caveats">
              Methodology: the map background and place names above are a real
              live map (OpenStreetMap). Site coordinates are geocoded live via
              Google Maps (if a key is configured on the backend) or the free
              OpenStreetMap Nominatim service, in that order — only falling back
              to an approximation near the facility's city/country when neither
              live lookup succeeds (
              {allSites.filter((s) => s.coordsSource === "approximate").length}{" "}
              of {allSites.length} site(s) here). Each site's {radiusMiles}-mile
              catchment is now checked using real driving distance (Google
              Distance Matrix, or the free OSRM router) wherever available —
              only falling back to straight-line distance when neither
              succeeds (
              {allSites.filter((s) => s.catchmentDistanceSource === "approximate-haversine" || s.catchmentDistanceSource === "mixed").length}{" "}
              of {allSites.length} site(s) had some or all points fall back
              this way). Patient population within the radius comes from a
              synthetic dataset — no live public source publishes real
              population by postal area for arbitrary countries — combined
              with an AI-estimated disease prevalence rate. The "Exclude
              patients already enrolled in another trial" checkbox above the
              table toggles between "Available" (eligible patients minus an
              estimated already-enrolled-elsewhere share, from real
              completed-trial benchmarks when available, else a fixed
              baseline) and "Available + Enrolled" (the full eligible
              population). A small illustrative sample of synthetic
              patient-level records per site (Patient ID, age, named
              comorbidity flags, Available/Enrolled status) is available via
              "View sample patients" below the table — fabricated data
              standing in for real per-patient EHR/claims/CTMS records, which
              have no live public source. "Expected Recruitment" applies each
              site's own synthetic consent/conversion rate (shown under the
              number) to the Available figure — eligible patients don't all
              convert to enrolled patients, so this is Available × rate, not
              the full Available population. No live or LLM source discloses
              a real per-site conversion rate, so this rate is a fabricated,
              per-site variation around the app's configured default, not a
              measured figure. The Segments column further splits
              Available into illustrative treatment-stage buckets
              (newly-diagnosed / non-responder / stable) using a fixed
              assumption, not real claims data — see each site's popup for
              the full breakdown. Risk scores are AI-estimated — no public
              per-site clinical-trial risk database was found.
            </p>
          </>
        )}

        {data && allSites.length === 0 && !error && (
          <p className="predict-placeholder">
            No live sites found for this search.
          </p>
        )}
      </div>
    </>
  );
}
