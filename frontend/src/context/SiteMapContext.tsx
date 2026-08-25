import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CombinedCatchmentResponse,
  EligibilityFilterSetResponse,
  LiveMapResponse,
  MapSiteRow,
} from "../types";
import {
  fetchCombinedCatchment,
  fetchLiveSiteMap,
} from "../services/map.service";
import { fetchEligibilityFilters } from "../services/eligibilityFilters.service";
import { usePipeline } from "../hooks/usePipeline";
import { countriesFromRegionKeys } from "../utils/region";
import {
  SITE_MAP_RADIUS_MILES,
  type SortKey,
} from "../utils/siteMapFormat";

/**
 * All of the Site Map's data-fetching + filter/sort/selection state — moved
 * verbatim out of the old single-file SiteMapView.tsx (which was embedded
 * as a duplicated "Site Map (Global)" tab in 3 different panels) so the
 * new Site Map (Global) / Site Map Details / Site Combination Planner
 * pages can share one in-memory copy instead of each re-fetching. Nothing
 * here changes what's fetched or how it's computed — only where the state
 * lives. Leaflet map instance/marker refs are NOT here; those are
 * inherently tied to the Global page's DOM node and stay local to that
 * page component.
 */
export interface SiteMapState {
  indication: string;
  selectedCountries: string[];
  country: string;
  setCountry: (c: string) => void;

  data: LiveMapResponse | null;
  loading: boolean;
  error: string | null;
  runSearch: () => Promise<void>;

  allSites: MapSiteRow[];
  filteredSites: MapSiteRow[];
  sortedSites: MapSiteRow[];

  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;

  search: string;
  setSearch: (s: string) => void;

  sortKey: SortKey;
  sortDir: "asc" | "desc";
  toggleSort: (key: SortKey) => void;
  sortArrow: (key: SortKey) => string;

  combineIds: Set<string>;
  toggleCombine: (siteId: string) => void;
  combineResult: CombinedCatchmentResponse | null;
  combineLoading: boolean;
  combineError: string | null;
  computeCombined: () => Promise<void>;
  clearCombine: () => void;

  eligFilters: EligibilityFilterSetResponse | null;
  eligFiltersLoading: boolean;
  eligFiltersError: string | null;
  selectedFilterIds: Set<string>;
  toggleEligFilter: (id: string) => void;
  clearEligFilters: () => void;
  allFiltersSelected: boolean;
  toggleSelectAllFilters: () => void;
  activeEligFilters: EligibilityFilterSetResponse["filters"];
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean | ((v: boolean) => boolean)) => void;

  excludeEnrolled: boolean;
  setExcludeEnrolled: (v: boolean) => void;
  baseAvailable: (site: MapSiteRow) => number;
  adjustedNetAvailable: (site: MapSiteRow) => number;
  expectedRecruitment: (site: MapSiteRow) => number;
}

export const SiteMapContext = createContext<SiteMapState | null>(null);

export function SiteMapProvider({ children }: { children: ReactNode }) {
  const { form, running } = usePipeline();
  const indication = form.indication;
  const selectedCountries = useMemo(
    () => countriesFromRegionKeys(form.regions),
    [form.regions],
  );

  const [country, setCountry] = useState("");
  const [data, setData] = useState<LiveMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("net");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [combineIds, setCombineIds] = useState<Set<string>>(new Set());
  const [combineResult, setCombineResult] =
    useState<CombinedCatchmentResponse | null>(null);
  const [combineLoading, setCombineLoading] = useState(false);
  const [combineError, setCombineError] = useState<string | null>(null);

  const [eligFilters, setEligFilters] =
    useState<EligibilityFilterSetResponse | null>(null);
  const [eligFiltersLoading, setEligFiltersLoading] = useState(false);
  const [eligFiltersError, setEligFiltersError] = useState<string | null>(
    null,
  );
  const [selectedFilterIds, setSelectedFilterIds] = useState<Set<string>>(
    new Set(),
  );
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

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
    allFilterIds.length > 0 &&
    allFilterIds.every((id) => selectedFilterIds.has(id));

  function clearEligFilters() {
    setSelectedFilterIds(new Set());
  }

  function toggleSelectAllFilters() {
    setSelectedFilterIds(
      allFiltersSelected ? new Set() : new Set(allFilterIds),
    );
  }

  const activeEligFilters = useMemo(
    () => (eligFilters?.filters ?? []).filter((f) => selectedFilterIds.has(f.id)),
    [eligFilters, selectedFilterIds],
  );

  const combinedRetainFraction = useMemo(
    () =>
      activeEligFilters.reduce(
        (acc, f) => acc * (1 - f.estimatedExcludedPercent / 100),
        1,
      ),
    [activeEligFilters],
  );

  function baseAvailable(site: MapSiteRow): number {
    return excludeEnrolled ? site.netAvailablePatients : site.grossEligiblePatients;
  }

  function adjustedNetAvailable(site: MapSiteRow): number {
    const base = baseAvailable(site);
    if (activeEligFilters.length === 0) return base;
    return Math.max(0, Math.round(base * combinedRetainFraction));
  }

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

  function clearCombine() {
    setCombineIds(new Set());
    setCombineResult(null);
    setCombineError(null);
  }

  const allSites = data?.sites ?? [];

  async function computeCombined() {
    const chosen = allSites.filter((s) => combineIds.has(s.siteId));
    if (chosen.length < 2 || !data) return;
    setCombineLoading(true);
    setCombineError(null);
    try {
      const res = await fetchCombinedCatchment({
        indication,
        country: chosen[0].country,
        radiusMiles: SITE_MAP_RADIUS_MILES,
        sites: chosen.map((s) => ({
          siteId: s.siteId,
          lat: s.lat,
          lng: s.lng,
          netAvailablePatients: s.netAvailablePatients,
        })),
        ageGroups: form.ageGroups,
      });
      setCombineResult(res);
    } catch (err) {
      setCombineError((err as Error).message);
      setCombineResult(null);
    } finally {
      setCombineLoading(false);
    }
  }

  // Keep `country` in sync with the trial form's selected region(s) —
  // default to the first selected country, or clear it (falls back to a
  // global search) if nothing is selected or the current pick fell out of
  // the list.
  useEffect(() => {
    if (selectedCountries.length === 0) {
      if (country) setCountry("");
    } else if (!selectedCountries.includes(country)) {
      setCountry(selectedCountries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries]);

  async function runSearch() {
    if (!indication) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLiveSiteMap({
        indication,
        country: country || undefined,
        radiusMiles: SITE_MAP_RADIUS_MILES,
        ageGroups: form.ageGroups,
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

  const wasRunningRef = useRef(false);
  useEffect(() => {
    const justStarted = running && !wasRunningRef.current;
    wasRunningRef.current = running;
    if (justStarted && indication) {
      runSearch();
    }
  }, [running]);

  // Searches automatically — for the default (first selected) country as
  // soon as one resolves, and again every time the country dropdown
  // changes — instead of requiring a manual "Search" click each time.
  // Waits for `country` to actually settle to a real value (set by the
  // sync effect above) rather than firing on the same-render "" — otherwise
  // this would kick off an unscoped/all-countries search instead of the
  // intended one.
  useEffect(() => {
    if (!indication) return;
    if (selectedCountries.length > 0 && !country) return;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indication, country, selectedCountries]);

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSites;
    return allSites.filter((s) =>
      [s.siteName, s.city, s.state, s.country]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const value: SiteMapState = {
    indication,
    selectedCountries,
    country,
    setCountry,
    data,
    loading,
    error,
    runSearch,
    allSites,
    filteredSites,
    sortedSites,
    selectedSiteId,
    setSelectedSiteId,
    search,
    setSearch,
    sortKey,
    sortDir,
    toggleSort,
    sortArrow,
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
  };

  return (
    <SiteMapContext.Provider value={value}>{children}</SiteMapContext.Provider>
  );
}

export function useSiteMap(): SiteMapState {
  const ctx = useContext(SiteMapContext);
  if (!ctx) {
    throw new Error("useSiteMap() must be used within a SiteMapProvider");
  }
  return ctx;
}
