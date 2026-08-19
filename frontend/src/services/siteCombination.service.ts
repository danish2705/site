import type { SiteCombinationResponse } from "../types";
import { postJson } from "./api";

export interface SiteCombinationParams {
  indication: string;
  country: string;
  targetEnrollment: number;
  sites: {
    siteId: string;
    siteName: string;
    netAvailablePatients: number;
    riskScore: number | null;
  }[];
}

/** Which combination of already-found candidate sites reaches a target enrollment for the least cost/risk — see backend pipeline/siteCombinationOptimizer.ts for the (greedy, non-exhaustive) method. */
export function fetchSiteCombination(
  params: SiteCombinationParams,
): Promise<SiteCombinationResponse> {
  return postJson<SiteCombinationResponse>(
    "/api/site-combination",
    params,
    "Could not compute a site combination for this target enrollment.",
  );
}
