/**
 * Country-level broad age-band population shares, used to make the
 * sidebar's "Age Group" selector (Child (0-17) / Adult (18-64) / Older
 * Adult (65+) — see frontend components/layout/Sidebar.tsx's AGE_GROUPS)
 * actually change the Site Map's eligible-patient numbers, instead of only
 * being a cosmetic label on the requirement summary (which is all it did
 * before this file existed — see runPipeline.ts's "Age group: ..." text
 * and eligibilityFilters.ts's now-inaccurate "already handled elsewhere"
 * comment, neither of which fed into any real number).
 *
 * WHAT THIS IS: real, publicly documented national demographic patterns —
 * the approximate share of each country's TOTAL population in each of the
 * three age bands the sidebar offers. Same convention as
 * data/syntheticPopulation.ts's COUNTRY_BOUNDING_BOXES: a static table of
 * real-world facts, not a live per-request API call, and not fabricated.
 *
 * HONESTY CAVEATS (also surfaced in the API response, not just here):
 *  1. Not machine-fetched from a live UN/World Bank API this session —
 *     approximate values consistent with published UN World Population
 *     Prospects (2024 revision) broad age-group data, rounded to whole
 *     percentage points. Good enough to meaningfully scale an estimate,
 *     not a precision figure.
 *  2. This is a NATIONAL population statistic, not this specific
 *     facility's actual patient population or this specific trial's real
 *     eligibility bounds (ClinicalTrials.gov's own MinimumAge/MaximumAge
 *     fields, fetched elsewhere in services/ctgov.client.ts, are the real
 *     per-trial figure — this table is a country-level PROXY used only
 *     when the user has manually selected one or more Age Groups on the
 *     sidebar, since that selection isn't tied to any specific live trial
 *     record's own age bounds).
 */

export interface BroadAgeShares {
  /** Share of total population aged 0-17 (0-100). */
  child: number;
  /** Share aged 18-64 (0-100). */
  adult: number;
  /** Share aged 65+ (0-100). */
  olderAdult: number;
}

// Matches frontend components/layout/Sidebar.tsx's AGE_GROUPS labels exactly
// (including the en-dash) — kept here too so a lookup failure due to a
// label mismatch is impossible to miss (see matchAgeGroupLabel below, which
// deliberately does NOT require an exact string match, for resilience).
export const AGE_GROUP_LABELS = {
  child: "Child (0–17)",
  adult: "Adult (18–64)",
  olderAdult: "Older Adult (65+)",
} as const;

export const AGE_ELIGIBILITY_DISCLOSURE =
  "When one or more Age Groups are selected on the trial form, each site's " +
  "eligible-patient estimate is scaled down to just that group's share of " +
  "its country's population (approximate, based on published UN World " +
  "Population Prospects 2024 broad age-group patterns — not a live " +
  "per-request fetch, and not this specific trial's own disclosed " +
  "MinimumAge/MaximumAge). Leaving Age Group unset assumes all ages (no " +
  "adjustment). Countries not covered fall back to a global-average mix, " +
  "flagged in this response's warnings.";

// Real-world-consistent, approximate. See file header for sourcing caveats.
const COUNTRY_BROAD_AGE_SHARES: Record<string, BroadAgeShares> = {
  "United States": { child: 22, adult: 61, olderAdult: 17 },
  Canada: { child: 18, adult: 62, olderAdult: 20 },
  "United Kingdom": { child: 18, adult: 62, olderAdult: 20 },
  France: { child: 18, adult: 60, olderAdult: 22 },
  Germany: { child: 14, adult: 61, olderAdult: 25 },
  Spain: { child: 15, adult: 62, olderAdult: 23 },
  Italy: { child: 13, adult: 60, olderAdult: 27 },
  Netherlands: { child: 16, adult: 62, olderAdult: 22 },
  Sweden: { child: 18, adult: 60, olderAdult: 22 },
  Poland: { child: 16, adult: 63, olderAdult: 21 },
  "Czech Republic": { child: 16, adult: 63, olderAdult: 21 },
  Romania: { child: 17, adult: 63, olderAdult: 20 },
  India: { child: 26, adult: 67, olderAdult: 7 },
  Egypt: { child: 33, adult: 61, olderAdult: 6 },
  Nigeria: { child: 43, adult: 54, olderAdult: 3 },
  Kenya: { child: 39, adult: 58, olderAdult: 3 },
  "South Africa": { child: 28, adult: 64, olderAdult: 8 },
  Philippines: { child: 30, adult: 63, olderAdult: 7 },
  Vietnam: { child: 23, adult: 68, olderAdult: 9 },
  Indonesia: { child: 25, adult: 67, olderAdult: 8 },
  "South Korea": { child: 12, adult: 70, olderAdult: 18 },
  Japan: { child: 12, adult: 59, olderAdult: 29 },
  China: { child: 17, adult: 68, olderAdult: 15 },
  Taiwan: { child: 13, adult: 68, olderAdult: 19 },
  Colombia: { child: 22, adult: 67, olderAdult: 11 },
  Peru: { child: 25, adult: 65, olderAdult: 10 },
  Argentina: { child: 24, adult: 63, olderAdult: 13 },
  Chile: { child: 20, adult: 65, olderAdult: 15 },
  Israel: { child: 27, adult: 61, olderAdult: 12 },
  "United Arab Emirates": { child: 14, adult: 82, olderAdult: 4 },
  "Saudi Arabia": { child: 25, adult: 71, olderAdult: 4 },
  Bangladesh: { child: 27, adult: 65, olderAdult: 8 },
  "Sri Lanka": { child: 22, adult: 64, olderAdult: 14 },
  Pakistan: { child: 35, adult: 60, olderAdult: 5 },
  Australia: { child: 19, adult: 64, olderAdult: 17 },
};

// Used when a site's country is missing/unrecognized — a plausible global
// blend, not any single real country's figure. Never silently substituted
// without a warning surfacing to the caller.
const GLOBAL_AVERAGE_BROAD_AGE_SHARES: BroadAgeShares = {
  child: 24,
  adult: 64,
  olderAdult: 12,
};

function matchAgeGroupLabel(
  label: string,
): "child" | "adult" | "olderAdult" | null {
  // Order matters: check "Older Adult" before the generic "Adult" so
  // "Older Adult (65+)" doesn't get missed by an exact-label mismatch —
  // this is deliberately loose (startsWith on the keyword) rather than an
  // exact string match against AGE_GROUP_LABELS, so a minor label wording
  // change on the sidebar doesn't silently break this into "no adjustment
  // applied" with no error.
  if (/older\s*adult/i.test(label)) return "olderAdult";
  if (/^child/i.test(label)) return "child";
  if (/^adult/i.test(label)) return "adult";
  return null;
}

export interface AgeEligibleFractionResult {
  /** 0-1. 1 means "no narrowing" (no age groups selected — all ages included). */
  fraction: number;
  /** false when the country wasn't recognized and the global-average fallback was used (only meaningful when ageGroups is non-empty). */
  matched: boolean;
  /** Which of the three canonical labels were actually recognized and applied — for surfacing in warnings/labels. Empty when ageGroups was empty (all ages). */
  appliedGroups: string[];
}

/**
 * Core of the fix: turns the sidebar's manually-selected Age Group labels
 * into an actual multiplier on a site's eligible-patient count, using this
 * file's country-level real-world age-structure table. Returns fraction=1
 * (no change) when ageGroups is empty/absent, matching the sidebar's own
 * "leave unset to include all ages" hint.
 */
export function getAgeEligibleFraction(
  ageGroups: string[] | null | undefined,
  country: string | null | undefined,
): AgeEligibleFractionResult {
  if (!ageGroups || ageGroups.length === 0) {
    return { fraction: 1, matched: true, appliedGroups: [] };
  }

  const found = country ? COUNTRY_BROAD_AGE_SHARES[country] : undefined;
  const shares = found ?? GLOBAL_AVERAGE_BROAD_AGE_SHARES;

  let sum = 0;
  const appliedGroups: string[] = [];
  for (const raw of ageGroups) {
    const key = matchAgeGroupLabel(raw);
    if (!key) continue;
    sum += shares[key];
    appliedGroups.push(AGE_GROUP_LABELS[key]);
  }

  return {
    fraction: Math.max(0, Math.min(1, sum / 100)),
    matched: !!found,
    appliedGroups,
  };
}
