import type { NctLookupResponse } from "../types";
import { apiJson } from "./api";

/**
 * Landing page's "Search by NCT Number" — looks up one real ClinicalTrials.gov
 * study, already normalized onto this app's own TrialForm values by the
 * backend (see backend's controllers/nctLookup.controller.ts).
 */
export function fetchNctLookup(nctId: string): Promise<NctLookupResponse> {
  return apiJson<NctLookupResponse>(
    `/api/nct-lookup/${encodeURIComponent(nctId.trim())}`,
    {
      fallbackError:
        "Could not look up that NCT number. Double-check it, or use Enter Study Details Manually instead.",
    },
  );
}
