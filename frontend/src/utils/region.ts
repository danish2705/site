// Composite key used by the Region / Country Selection input, so each
// checkbox option value uniquely identifies a (Region, Country) pair.
export const regionKey = (region: string, country: string) =>
  `${region}||${country}`;

/** Inverse of regionKey — splits "Region||Country" back into its parts. */
export function parseRegionKey(key: string): {
  region: string;
  country: string;
} {
  const [region, country] = key.split("||");
  return { region, country };
}
