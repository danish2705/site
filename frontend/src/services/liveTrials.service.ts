import type { LiveTrialLandscapeResponse } from "../types";
import { apiJson } from "./api";

export interface LiveTrialLandscapeParams {
  indication: string;
  /** Omit for a global search across every country ClinicalTrials.gov returns. */
  country?: string;
}

/** Every real trial ClinicalTrials.gov has on record for this indication (any status) plus the live count of how many count as "active/competing" under the app's current business definition — see backend config.ts's competingTrials.statuses and controllers/liveTrials.controller.ts. */
export function fetchLiveTrialLandscape(
  params: LiveTrialLandscapeParams,
): Promise<LiveTrialLandscapeResponse> {
  const qs = new URLSearchParams({ indication: params.indication });
  if (params.country) qs.set("country", params.country);
  return apiJson<LiveTrialLandscapeResponse>(
    `/api/live-trials?${qs.toString()}`,
    { fallbackError: "Could not load the live trial landscape." },
  );
}
