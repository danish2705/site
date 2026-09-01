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
export function allConfiguredCountries(
  regionOptions: { country: string }[],
): string[] {
  return [...new Set(regionOptions.map((r) => r.country).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}
