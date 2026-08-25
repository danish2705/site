import { useEffect, useRef, useState } from "react";
import type { LiveMapResponse, MapSiteRow } from "../types";
import { fetchLiveSiteMap } from "../services/map.service";
import { usePipeline } from "./usePipeline";
import { countriesFromRegionKeys } from "../utils/region";
import { SITE_MAP_RADIUS_MILES } from "../utils/siteMapFormat";

export interface IndependentSiteSearchState {
  indication: string;
  selectedCountries: string[];
  country: string;
  setCountry: (country: string) => void;
  data: LiveMapResponse | null;
  loading: boolean;
  error: string | null;
  runSearch: () => Promise<void>;
  allSites: MapSiteRow[];
}

/**
 * Per-page country + live site-map search state. Each call to this hook
 * owns its OWN country selection and OWN fetched site data — it is
 * deliberately NOT shared via context, so that Site Map (Global), Site Map
 * Details, and Site Combination Planner can each be pointed at a different
 * country independently (picking a country on one no longer changes what
 * the other two show). This does mean each page re-fetches its own copy of
 * the same underlying data when both happen to be searching the same
 * country — an intentional tradeoff for independence, per request.
 *
 * Mirrors the country-defaulting and "auto-run when Run Analysis starts"
 * behavior SiteMapContext.tsx has, since those still make sense per-page.
 */
export function useIndependentSiteSearch(): IndependentSiteSearchState {
  const { form, running } = usePipeline();
  const indication = form.indication;
  const selectedCountries = countriesFromRegionKeys(form.regions);
  const selectedCountriesKey = selectedCountries.join("|");

  const [country, setCountry] = useState("");
  const [data, setData] = useState<LiveMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep `country` in sync with the trial form's selected region(s) —
  // default to the first selected country, or clear it (falls back to a
  // global search) if nothing is selected or the current pick fell out of
  // the list. Same rule SiteMapContext.tsx uses, just scoped to this one
  // page's own `country` state instead of a shared one.
  useEffect(() => {
    setCountry((prev) => {
      if (selectedCountries.length === 0) return prev ? "" : prev;
      return selectedCountries.includes(prev) ? prev : selectedCountries[0];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountriesKey]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Searches automatically — for the default (first selected) country as
  // soon as one resolves, and again every time this page's own country
  // dropdown changes — instead of requiring a manual "Search" click each
  // time. Waits for `country` to actually settle to a real value (set by
  // the sync effect above) rather than firing on the same-render "" —
  // otherwise this would kick off an unscoped/all-countries search instead
  // of the intended one.
  useEffect(() => {
    if (!indication) return;
    if (selectedCountries.length > 0 && !country) return;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indication, country, selectedCountriesKey]);

  return {
    indication,
    selectedCountries,
    country,
    setCountry,
    data,
    loading,
    error,
    runSearch,
    allSites: data?.sites ?? [],
  };
}
