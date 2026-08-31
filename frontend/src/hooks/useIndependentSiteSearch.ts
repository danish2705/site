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

export function useIndependentSiteSearch(): IndependentSiteSearchState {
  const { form, running } = usePipeline();
  const indication = form.indication;
  const selectedCountries = countriesFromRegionKeys(form.regions);
  const selectedCountriesKey = selectedCountries.join("|");

  const [country, setCountry] = useState("");
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
  }, [running]);

  useEffect(() => {
    if (!indication) return;
    if (selectedCountries.length > 0 && !country) return;
    runSearch();
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
