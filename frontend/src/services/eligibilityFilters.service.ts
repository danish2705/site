import type { EligibilityFilterSetResponse } from "../types";
import { apiJson } from "./api";

/** Real eligibility criteria text + LLM-estimated per-criterion exclusion percentages for the Site Map's "Net Available" filter dropdown — see backend pipeline/eligibilityFilters.ts. */
export function fetchEligibilityFilters(
  indication: string,
): Promise<EligibilityFilterSetResponse> {
  const qs = new URLSearchParams({ indication });
  return apiJson<EligibilityFilterSetResponse>(
    `/api/eligibility-filters?${qs.toString()}`,
    { fallbackError: "Could not load eligibility filters for this indication." },
  );
}
