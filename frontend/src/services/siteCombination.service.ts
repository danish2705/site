import type {
  OutreachDraftResponse,
  SiteCombinationResponse,
} from "../types";
import { postJson } from "./api";

export interface SiteCombinationParams {
  indication: string;
  country: string;
  targetEnrollment: number;
  sites: {
    siteId: string;
    siteName: string;
    city?: string | null;
    country?: string | null;
    recruitablePatients: number;
    riskScore: number | null;
    baseCostUsd?: number | null;
    perPatientCostUsd?: number | null;
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

export interface OutreachDraftParams {
  indication: string;
  phase?: string;
  targetEnrollment?: number;
  senderOrganization?: string;
  sites: {
    siteId: string;
    siteName: string;
    city?: string | null;
    country?: string | null;
  }[];
}

/** Drafts (text only, never sent) a site-outreach email per site — see backend pipeline/outreachDraft.ts. Every contact address returned is a labeled synthetic placeholder. */
export function fetchOutreachDraft(
  params: OutreachDraftParams,
): Promise<OutreachDraftResponse> {
  return postJson<OutreachDraftResponse>(
    "/api/outreach-draft",
    params,
    "Could not generate outreach drafts for these sites.",
  );
}
