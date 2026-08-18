import type { LiveMapResponse } from "../types";
import { apiJson } from "./api";

export interface LiveSiteMapParams {
  indication: string;
  /** Omit for a global search across every country ClinicalTrials.gov returns. */
  country?: string;
  radiusMiles?: number;
}

export function fetchLiveSiteMap(
  params: LiveSiteMapParams,
): Promise<LiveMapResponse> {
  const qs = new URLSearchParams({ indication: params.indication });
  if (params.country) qs.set("country", params.country);
  if (params.radiusMiles) qs.set("radiusMiles", String(params.radiusMiles));
  return apiJson<LiveMapResponse>(`/api/live-map?${qs.toString()}`, {
    fallbackError: "Could not load the site map.",
  });
}
