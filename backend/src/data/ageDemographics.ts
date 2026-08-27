export interface BroadAgeShares {
  child: number;
  adult: number;
  olderAdult: number;
}

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

const GLOBAL_AVERAGE_BROAD_AGE_SHARES: BroadAgeShares = {
  child: 24,
  adult: 64,
  olderAdult: 12,
};

function matchAgeGroupLabel(
  label: string,
): "child" | "adult" | "olderAdult" | null {
  if (/older\s*adult/i.test(label)) return "olderAdult";
  if (/^child/i.test(label)) return "child";
  if (/^adult/i.test(label)) return "adult";
  return null;
}

export interface AgeEligibleFractionResult {
  fraction: number;
  matched: boolean;
  appliedGroups: string[];
}

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
