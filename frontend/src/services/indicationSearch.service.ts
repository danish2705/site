import { apiJson } from "./api";

export interface IndicationSearchResponse {
  query: string;
  results: string[];
}

export function searchIndications(query: string): Promise<IndicationSearchResponse> {
  const qs = new URLSearchParams({ q: query });
  return apiJson<IndicationSearchResponse>(
    `/api/indication-search?${qs.toString()}`,
    { fallbackError: "Could not search indications." },
  );
}
