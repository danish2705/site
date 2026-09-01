import { apiJson } from "./api";

export interface IndicationSearchResponse {
  query: string;
  results: string[];
}

/**
 * Live search over ClinicalTrials.gov's real condition vocabulary — see
 * backend's controllers/indicationSearch.controller.ts. Backs the Indication
 * field's search-as-you-type; the pre-loaded /api/meta list is capped at the
 * top 250 most common conditions and can't surface anything past that.
 */
export function searchIndications(query: string): Promise<IndicationSearchResponse> {
  const qs = new URLSearchParams({ q: query });
  return apiJson<IndicationSearchResponse>(
    `/api/indication-search?${qs.toString()}`,
    { fallbackError: "Could not search indications." },
  );
}
