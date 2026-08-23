import type { CombinedCatchmentResponse, LiveMapResponse } from "../types";
import { apiJson, postJson } from "./api";

export interface LiveSiteMapParams {
  indication: string;
  /** Omit for a global search across every country ClinicalTrials.gov returns. */
  country?: string;
  radiusMiles?: number;
  /** The trial form's selected Age Group(s) (e.g. "Adult (18–64)") — see backend data/ageDemographics.ts. Omit/empty = all ages. */
  ageGroups?: string[];
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
  return apiJson<LiveMapResponse>(`/api/live-map?${qs.toString()}`, {
    fallbackError: "Could not load the site map.",
  });
}

export interface CombinedCatchmentParams {
  indication: string;
  country: string;
  radiusMiles: number;
  sites: { siteId: string; lat: number; lng: number; netAvailablePatients: number }[];
  /** Same Age Group narrowing as LiveSiteMapParams. Omit/empty = all ages. */
  ageGroups?: string[];
}

/** De-duplicated patient count for a set of selected sites together — see backend pipeline/liveMapData.ts's buildCombinedCatchment for why summing each site's own number would double-count overlap. */
export function fetchCombinedCatchment(
  params: CombinedCatchmentParams,
): Promise<CombinedCatchmentResponse> {
  return postJson<CombinedCatchmentResponse>(
    "/api/live-map/combined-catchment",
    params,
    "Could not compute the combined catchment for the selected sites.",
  );
}
