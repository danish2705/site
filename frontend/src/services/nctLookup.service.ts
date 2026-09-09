import type { NctLookupResponse } from "../types";
import { apiJson } from "./api";

export function fetchNctLookup(nctId: string): Promise<NctLookupResponse> {
  return apiJson<NctLookupResponse>(
    `/api/nct-lookup/${encodeURIComponent(nctId.trim())}`,
    {
      fallbackError:
        "Could not look up that NCT number. Double-check it, or use Enter Study Details Manually instead.",
    },
  );
}
