import type { RareDiseaseDetail, RareDiseaseSearchResult } from "../types";
import { apiJson } from "./api";

export function fetchRareDiseaseStatus(): Promise<{ configured: boolean }> {
  return apiJson<{ configured: boolean }>("/api/rare-disease/status");
}

export function searchRareDiseases(
  query: string,
): Promise<{ query: string; results: RareDiseaseSearchResult[] }> {
  return apiJson<{ query: string; results: RareDiseaseSearchResult[] }>(
    `/api/rare-disease/search?q=${encodeURIComponent(query)}`,
    {
      fallbackError: "Rare disease search failed. Try again in a moment.",
    },
  );
}

export function fetchRareDiseaseDetail(orphaCode: string): Promise<RareDiseaseDetail> {
  return apiJson<RareDiseaseDetail>(
    `/api/rare-disease/${encodeURIComponent(orphaCode)}`,
    {
      fallbackError: "Could not load this disease's data. Try again in a moment.",
    },
  );
}
