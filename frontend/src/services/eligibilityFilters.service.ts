import type { EligibilityFilterSetResponse } from "../types";
import { apiJson } from "./api";

export function fetchEligibilityFilters(
  indication: string,
): Promise<EligibilityFilterSetResponse> {
  const qs = new URLSearchParams({ indication });
  return apiJson<EligibilityFilterSetResponse>(
    `/api/eligibility-filters?${qs.toString()}`,
    { fallbackError: "Could not load eligibility filters for this indication." },
  );
}
