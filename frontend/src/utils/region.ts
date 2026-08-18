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
