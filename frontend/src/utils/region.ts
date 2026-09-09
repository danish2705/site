export const regionKey = (region: string, country: string) =>
  `${region}||${country}`;

export function parseRegionKey(key: string): {
  region: string;
  country: string;
} {
  const [region, country] = key.split("||");
  return { region, country };
}

export function countriesFromRegionKeys(keys: string[]): string[] {
  return [
    ...new Set(
      keys.map((k) => parseRegionKey(k).country).filter((c): c is string => !!c),
    ),
  ];
}

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
