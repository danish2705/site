import { useEffect, useRef, useState } from "react";
import type { LiveMapResponse, MapSiteRow } from "../types";
import { fetchLiveSiteMap } from "../services/map.service";
import { usePipeline } from "./usePipeline";
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
  /** Catchment radius (miles) used both for the backend's population lookup
      and for the ring drawn around a selected site — see the Site Map's
      "Catchment" filter (redesign spec item 10). Defaults to
      SITE_MAP_RADIUS_MILES; changing it re-runs the search. */
  radiusMiles: number;
  setRadiusMiles: (radiusMiles: number) => void;
}

export function useIndependentSiteSearch(): IndependentSiteSearchState {
  const { form, running, selectedCountries, nctScope } = usePipeline();
  const indication = form.indication;
  const selectedCountriesKey = selectedCountries.join("|");

  const [country, setCountry] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(SITE_MAP_RADIUS_MILES);
  const [data, setData] = useState<LiveMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCountry((prev) => {
      if (selectedCountries.length === 0) return prev ? "" : prev;
      return selectedCountries.includes(prev) ? prev : selectedCountries[0];
    });
  }, [selectedCountriesKey]);

  async function runSearch() {
    if (!indication) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLiveSiteMap({
        indication,
        country: country || undefined,
        radiusMiles,
        ageGroups: form.ageGroups,
        // Scoped mode: plot ONLY this trial's own disclosed sites — see
        // PipelineContext's nctScope/runAnalysisFromNct.
        nctId: nctScope || undefined,
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
  }, [running]);

  useEffect(() => {
    if (!indication) return;
    if (selectedCountries.length > 0 && !country) return;
    runSearch();
  }, [indication, country, selectedCountriesKey, radiusMiles, nctScope]);

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
    radiusMiles,
    setRadiusMiles,
  };
}
