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
  sourceNctId: string | null;
  criteriaText: string | null;
  sex: string | null;
  minimumAge: string | null;
  maximumAge: string | null;
  healthyVolunteers: boolean | null;
  filters: EligibilityFilterOption[];
  filtersSource: "llm-estimated" | "unavailable";
  warning?: string;
}

const CACHE_TTL_MS = config.ctgov.cacheTtlMs;
const cache = new Map<string, { value: EligibilityFilterSet; expiresAt: number }>();

const AGE_LABEL_PATTERN = /\bage\b/i;

function dropRedundantAgeFilters(
  filters: EligibilityFilterOption[],
): EligibilityFilterOption[] {
  return filters.filter((f) => !AGE_LABEL_PATTERN.test(f.label));
}

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
