import type { CombinedCatchmentResponse, LiveMapResponse } from "../types";
import { apiJson, postJson } from "./api";

export interface LiveSiteMapParams {
  indication: string;
  country?: string;
  radiusMiles?: number;
  ageGroups?: string[];
  /** When set, the backend plots ONLY this trial's own disclosed sites instead of every trial for the indication — see PipelineContext's nctScope. */
  nctId?: string;
}

export function fetchLiveSiteMap(
  params: LiveSiteMapParams,
): Promise<LiveMapResponse> {
  const qs = new URLSearchParams({ indication: params.indication });
  if (params.country) qs.set("country", params.country);
  if (params.radiusMiles) qs.set("radiusMiles", String(params.radiusMiles));
  if (params.ageGroups && params.ageGroups.length > 0) {
    qs.set("ageGroups", params.ageGroups.join(","));
  }
  if (params.nctId) qs.set("nctId", params.nctId);
  return apiJson<LiveMapResponse>(`/api/live-map?${qs.toString()}`, {
    fallbackError: "Could not load the site map.",
  });
}

export interface CombinedCatchmentParams {
  indication: string;
  country: string;
  radiusMiles: number;
  sites: { siteId: string; lat: number; lng: number; netAvailablePatients: number }[];
  ageGroups?: string[];
}

export function fetchCombinedCatchment(
  params: CombinedCatchmentParams,
): Promise<CombinedCatchmentResponse> {
  return postJson<CombinedCatchmentResponse>(
    "/api/live-map/combined-catchment",
    params,
    "Could not compute the combined catchment for the selected sites.",
  );
}
