import { getEligibilityCriteriaSample } from "../services/ctgov.client.js";
import {
  estimateEligibilityFilterImpact,
  llmStatus,
  type EligibilityFilterEstimateItem,
} from "../llm/client.js";
import { config } from "../config.js";

export type EligibilityFilterOption = EligibilityFilterEstimateItem;

export interface EligibilityFilterSet {
  indication: string;
  /** Real, disclosed source trial for the criteria text below — see services/ctgov.client.ts's getEligibilityCriteriaSample. */
  sourceNctId: string | null;
  criteriaText: string | null;
  sex: string | null;
  minimumAge: string | null;
  maximumAge: string | null;
  healthyVolunteers: boolean | null;
  /**
   * Checkbox-able criteria extracted from criteriaText, each with an
   * LLM-estimated "% of the general indication population this criterion
   * alone would exclude" — see llm/client.ts's estimateEligibilityFilterImpact
   * for exactly what this is (and isn't): a reasoned estimate, not a
   * measured fact, and NOT cumulative across multiple selected filters (the
   * frontend combines them with a simple compounding formula, itself an
   * illustrative simplification).
   */
  filters: EligibilityFilterOption[];
  filtersSource: "llm-estimated" | "unavailable";
  warning?: string;
}

const CACHE_TTL_MS = config.ctgov.cacheTtlMs;
const cache = new Map<string, { value: EligibilityFilterSet; expiresAt: number }>();

// Age eligibility is already a separate, dedicated selection elsewhere in
// this app (the trial form's Age Group field / MapSiteRow's own age-bound
// fields) — a filter item duplicating it here would just be confusing, so
// this is a deterministic backstop in case the LLM includes one despite the
// prompt instruction not to (estimateEligibilityFilterImpact's INSTRUCTIONS
// #1). Matches "age" as a whole word so it won't false-positive on labels
// like "Prior stage IV disease".
const AGE_LABEL_PATTERN = /\bage\b/i;

function dropRedundantAgeFilters(
  filters: EligibilityFilterOption[],
): EligibilityFilterOption[] {
  return filters.filter((f) => !AGE_LABEL_PATTERN.test(f.label));
}

/**
 * Builds the full eligibility-filter picture for an indication: the real,
 * disclosed criteria text/sex/age/healthy-volunteers fields (same source as
 * Stage 1's requirement object), plus — when an LLM is configured and the
 * text is non-empty — a short list of checkbox-able filters with estimated
 * exclusion percentages for the Site Map's "Net Available" filter dropdown.
 *
 * Cached per-indication (same TTL as the ClinicalTrials.gov client cache)
 * since this involves both a live API call and, when available, an LLM
 * call — neither needs to re-run on every Site Map re-render.
 */
export async function buildEligibilityFilterSet(
  indication: string,
): Promise<EligibilityFilterSet> {
  const key = indication.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const sample = await getEligibilityCriteriaSample(indication);

  let filters: EligibilityFilterOption[] = [];
  let filtersSource: "llm-estimated" | "unavailable" = "unavailable";
  let warning: string | undefined;

  if (!sample?.eligibilityCriteriaText) {
    warning = `No trial for "${indication}" on ClinicalTrials.gov currently discloses eligibility criteria text — nothing to filter on.`;
  } else if (!llmStatus().configured) {
    warning =
      "LLM not configured (no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY in backend/.env) — cannot estimate how much each eligibility criterion would narrow the patient pool. Showing the raw criteria text only.";
  } else {
    try {
      const estimate = await estimateEligibilityFilterImpact({
        indication,
        criteriaText: sample.eligibilityCriteriaText,
      });
      filters = dropRedundantAgeFilters(estimate.filters);
      filtersSource = "llm-estimated";
      if (filters.length === 0) {
        warning =
          "The disclosed criteria text was too vague/administrative for the AI to extract meaningful filters from (age criteria are intentionally excluded here — see the trial form's own Age Group field) — showing the raw text only.";
      }
    } catch (err) {
      warning = `LLM eligibility-filter estimate failed (${(err as Error).message}) — showing the raw criteria text only.`;
    }
  }

  const value: EligibilityFilterSet = {
    indication,
    sourceNctId: sample?.sourceNctId ?? null,
    criteriaText: sample?.eligibilityCriteriaText ?? null,
    sex: sample?.sex ?? null,
    minimumAge: sample?.minimumAge ?? null,
    maximumAge: sample?.maximumAge ?? null,
    healthyVolunteers: sample?.healthyVolunteers ?? null,
    filters,
    filtersSource,
    warning,
  };

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
