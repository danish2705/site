import {
  CLAIMS_INDICATION_METRICS,
  type ClaimsIndicationMetrics,
} from "../data/claimsIndicationMetrics.js";

/**
 * Instant, in-memory lookup for Prevalence / Regulatory Approval Time /
 * Cost per Patient — checked by pipeline/liveRegionMetrics.ts BEFORE it
 * calls the LLM. Returns null whenever the indication or the country isn't
 * in the static table (see data/claimsIndicationMetrics.ts's doc comment
 * for exactly what is/isn't covered and why), in which case the caller
 * falls back to the existing LLM-estimate path unchanged.
 *
 * Exact-string match only, same convention as
 * repository/excelStore.ts's INDICATION_TO_SPECIALTY — an indication typed
 * or picked with different wording than the app's 24 known labels (e.g.
 * from the live ClinicalTrials.gov dropdown) simply won't match and falls
 * through to the LLM, same as it does today.
 */
export function getClaimsRegionMetrics(
  indication: string,
  country: string,
): ClaimsIndicationMetrics | null {
  const byCountry = CLAIMS_INDICATION_METRICS[indication];
  if (!byCountry) return null;
  const entry = byCountry[country];
  if (!entry) return null;
  return entry;
}
