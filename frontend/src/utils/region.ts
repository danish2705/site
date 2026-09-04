export const regionKey = (region: string, country: string) =>
  `${region}||${country}`;

export function parseRegionKey(key: string): {
  region: string;
  country: string;
} {
  const [region, country] = key.split("||");
  return { region, country };
}

/** De-duplicated list of countries behind a set of "region||country" keys — used to source the Site Map's country dropdown from whatever regions the trial form already has selected, instead of free-text entry. */
export function countriesFromRegionKeys(keys: string[]): string[] {
  return [
    ...new Set(
      keys.map((k) => parseRegionKey(k).country).filter((c): c is string => !!c),
    ),
  ];
}

/**
 * Every country this app is configured to search (backend's
 * data/regionMap.ts, surfaced via meta.regionOptions), de-duplicated and
 * sorted — the fallback country list for pages' country pickers when the
 * trial form has no region/country pre-selected (e.g. the landing page's
 * NCT-lookup flow, which deliberately searches every region globally rather
 * than pre-selecting one). Without this fallback, those pages had nothing to
 * populate their dropdown with and showed a permanently-disabled "no region
 * selected" placeholder even once a real, global analysis had already run.
 */
/**
 * Loose country-name equality (case-insensitive, either side may be a
 * substring of the other) — mirrors the backend's ctgov.client.ts
 * locationMatchesCountry, used here so a scoped NCT's own facility list
 * (grouped client-side by country) matches the same way the backend would
 * have matched it.
 */
export function countryMatches(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!b) return true;
  if (!a) return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.includes(y) || y.includes(x);
}

export function allConfiguredCountries(
  regionOptions: { country: string }[],
): string[] {
  return [...new Set(regionOptions.map((r) => r.country).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}
