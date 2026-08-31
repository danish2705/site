import type { LiveTrialLandscapeResponse } from "../types";
import { apiJson } from "./api";

export interface LiveTrialLandscapeParams {
  indication: string;
  country?: string;
  ageGroups?: string[];
}

export function fetchLiveTrialLandscape(
  params: LiveTrialLandscapeParams,
): Promise<LiveTrialLandscapeResponse> {
  const qs = new URLSearchParams({ indication: params.indication });
  if (params.country) qs.set("country", params.country);
  if (params.ageGroups && params.ageGroups.length > 0) {
    qs.set("ageGroups", params.ageGroups.join(","));
  }
  return apiJson<LiveTrialLandscapeResponse>(
    `/api/live-trials?${qs.toString()}`,
    { fallbackError: "Could not load the live trial landscape." },
  );
}
