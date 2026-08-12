export const regionKey = (region: string, country: string) =>
  `${region}||${country}`;

export function parseRegionKey(key: string): {
  region: string;
  country: string;
} {
  const [region, country] = key.split("||");
  return { region, country };
}
