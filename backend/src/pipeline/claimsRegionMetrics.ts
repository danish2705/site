import {
  CLAIMS_INDICATION_METRICS,
  type ClaimsIndicationMetrics,
} from "../data/claimsIndicationMetrics.js";

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
