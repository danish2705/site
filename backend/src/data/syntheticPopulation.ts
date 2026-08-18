/**
 * Bulk SYNTHETIC patient-catchment dataset used to answer "how many patients
 * live within N miles of this trial site" for the Site Map feature.
 *
 * WHY SYNTHETIC: no live, public API publishes real population figures (let
 * alone disease-specific patient counts) at postal/zip-code granularity for
 * arbitrary countries. The planning conversation this feature was scoped
 * from explicitly pointed at "synthetic data" for this exact number rather
 * than pretending a live source exists — so this file generates a large,
 * deterministic synthetic dataset instead. Every record is tagged
 * `populationSource: "synthetic"` all the way through to the API response
 * and the frontend caveats — it is never presented as real Census/claims
 * data.
 *
 * Two different kinds of fact are mixed here, deliberately kept distinct:
 *  - COUNTRY_BOUNDING_BOXES' lat/lng ranges are REAL, publicly known
 *    geography — used only to keep synthetic points inside plausible
 *    territory for each country.
 *  - Every point's exact position and population WITHIN that box is
 *    FABRICATED (seeded-random), standing in for data we don't have.
 *
 * Generation is deterministic (seeded off country name + index), so the
 * same country produces the same synthetic catchment points across
 * requests and process restarts, rather than different numbers every time
 * someone searches.
 */

export interface SyntheticPostalRegion {
  id: string;
  country: string;
  lat: number;
  lng: number;
  population: number;
}

interface CountryBoundingBox {
  country: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Real, approximate country bounding boxes (public geography) — mirrors the
// countries in data/regionMap.ts so the Site Map can cover the same global
// footprint the rest of the app already supports.
const COUNTRY_BOUNDING_BOXES: CountryBoundingBox[] = [
  {
    country: "United States",
    minLat: 25.8,
    maxLat: 49,
    minLng: -124.7,
    maxLng: -67,
  },
  { country: "Canada", minLat: 43, maxLat: 60, minLng: -130, maxLng: -55 },
  { country: "United Kingdom", minLat: 50, maxLat: 59, minLng: -7, maxLng: 2 },
  { country: "France", minLat: 42.3, maxLat: 51, minLng: -4.8, maxLng: 8.2 },
  { country: "Germany", minLat: 47.3, maxLat: 55, minLng: 6, maxLng: 15 },
  { country: "Spain", minLat: 36, maxLat: 43.5, minLng: -9.3, maxLng: 3.3 },
  { country: "Italy", minLat: 37, maxLat: 46.5, minLng: 7, maxLng: 18.5 },
  {
    country: "Netherlands",
    minLat: 50.7,
    maxLat: 53.5,
    minLng: 3.3,
    maxLng: 7.2,
  },
  { country: "Sweden", minLat: 55.3, maxLat: 68, minLng: 11, maxLng: 24 },
  { country: "Poland", minLat: 49, maxLat: 54.8, minLng: 14, maxLng: 24 },
  {
    country: "Czech Republic",
    minLat: 48.5,
    maxLat: 51,
    minLng: 12,
    maxLng: 18.8,
  },
  {
    country: "Romania",
    minLat: 43.6,
    maxLat: 48.2,
    minLng: 20.2,
    maxLng: 29.6,
  },
  { country: "India", minLat: 8, maxLat: 35, minLng: 68, maxLng: 97 },
  { country: "Egypt", minLat: 22, maxLat: 31.5, minLng: 25, maxLng: 35 },
  { country: "Nigeria", minLat: 4, maxLat: 13.9, minLng: 2.7, maxLng: 14.6 },
  { country: "Kenya", minLat: -4.7, maxLat: 5, minLng: 34, maxLng: 41.9 },
  {
    country: "South Africa",
    minLat: -34.8,
    maxLat: -22,
    minLng: 16.5,
    maxLng: 32.9,
  },
  { country: "Philippines", minLat: 5, maxLat: 19, minLng: 117, maxLng: 126.6 },
  {
    country: "Vietnam",
    minLat: 8.5,
    maxLat: 23.4,
    minLng: 102.1,
    maxLng: 109.5,
  },
  { country: "Indonesia", minLat: -10.4, maxLat: 6, minLng: 95, maxLng: 141 },
  {
    country: "South Korea",
    minLat: 33.1,
    maxLat: 38.6,
    minLng: 125.1,
    maxLng: 129.6,
  },
  { country: "Japan", minLat: 31, maxLat: 45.5, minLng: 130, maxLng: 145.8 },
  { country: "China", minLat: 20, maxLat: 49, minLng: 97, maxLng: 134 },
  { country: "Taiwan", minLat: 22, maxLat: 25.3, minLng: 120, maxLng: 122 },
  {
    country: "Colombia",
    minLat: -4.2,
    maxLat: 12.5,
    minLng: -79,
    maxLng: -66.9,
  },
  {
    country: "Peru",
    minLat: -18.3,
    maxLat: -0.03,
    minLng: -81.3,
    maxLng: -68.7,
  },
  {
    country: "Argentina",
    minLat: -55,
    maxLat: -21.8,
    minLng: -73.5,
    maxLng: -53.6,
  },
  {
    country: "Chile",
    minLat: -55.9,
    maxLat: -17.5,
    minLng: -75.6,
    maxLng: -66.4,
  },
  { country: "Israel", minLat: 29.5, maxLat: 33.3, minLng: 34.2, maxLng: 35.9 },
  {
    country: "United Arab Emirates",
    minLat: 22.6,
    maxLat: 26.1,
    minLng: 51,
    maxLng: 56.4,
  },
  {
    country: "Saudi Arabia",
    minLat: 16,
    maxLat: 32.2,
    minLng: 34.5,
    maxLng: 55.7,
  },
  {
    country: "Bangladesh",
    minLat: 20.6,
    maxLat: 26.6,
    minLng: 88,
    maxLng: 92.7,
  },
  {
    country: "Sri Lanka",
    minLat: 5.9,
    maxLat: 9.9,
    minLng: 79.6,
    maxLng: 81.9,
  },
  {
    country: "Pakistan",
    minLat: 23.7,
    maxLat: 37.1,
    minLng: 60.9,
    maxLng: 77.8,
  },
  {
    country: "Australia",
    minLat: -43.6,
    maxLat: -10.7,
    minLng: 113,
    maxLng: 153.6,
  },
];

interface CityAnchor {
  name: string;
  lat: number;
  lng: number;
  tier: "mega" | "large" | "mid";
}

// Real, publicly known major-city coordinates (approximate city-center
// points — not survey-precise, but real named places, unlike everything
// else in this file). WHY THIS EXISTS: the random point scatter below has
// no relationship to real geography — without this table, a real megacity
// could randomly end up with zero nearby high-population synthetic points
// (showing an implausibly small patient count right next to it) purely by
// chance, while an empty rural stretch could randomly get the big one
// instead. Anchoring a handful of each country's highest-population points
// at real major cities fixes that mismatch. The POPULATION figure attached
// to each anchor below is still a synthetic estimate (no live source exists
// for real disease-relevant population by postal area) — only the
// city's existence and approximate location are real.
const CITY_ANCHORS: Record<string, CityAnchor[]> = {
  "United States": [
    { name: "New York", lat: 40.71, lng: -74.01, tier: "mega" },
    { name: "Los Angeles", lat: 34.05, lng: -118.24, tier: "mega" },
    { name: "Chicago", lat: 41.88, lng: -87.63, tier: "large" },
    { name: "Houston", lat: 29.76, lng: -95.37, tier: "large" },
    { name: "Miami", lat: 25.76, lng: -80.19, tier: "large" },
    { name: "Phoenix", lat: 33.45, lng: -112.07, tier: "mid" },
  ],
  Canada: [
    { name: "Toronto", lat: 43.65, lng: -79.38, tier: "large" },
    { name: "Montreal", lat: 45.5, lng: -73.57, tier: "large" },
    { name: "Vancouver", lat: 49.28, lng: -123.12, tier: "mid" },
    { name: "Calgary", lat: 51.05, lng: -114.07, tier: "mid" },
  ],
  "United Kingdom": [
    { name: "London", lat: 51.51, lng: -0.13, tier: "mega" },
    { name: "Birmingham", lat: 52.48, lng: -1.9, tier: "mid" },
    { name: "Manchester", lat: 53.48, lng: -2.24, tier: "mid" },
    { name: "Glasgow", lat: 55.86, lng: -4.25, tier: "mid" },
  ],
  France: [
    { name: "Paris", lat: 48.86, lng: 2.35, tier: "mega" },
    { name: "Marseille", lat: 43.3, lng: 5.37, tier: "mid" },
    { name: "Lyon", lat: 45.76, lng: 4.84, tier: "mid" },
    { name: "Toulouse", lat: 43.6, lng: 1.44, tier: "mid" },
  ],
  Germany: [
    { name: "Berlin", lat: 52.52, lng: 13.4, tier: "large" },
    { name: "Hamburg", lat: 53.55, lng: 9.99, tier: "large" },
    { name: "Munich", lat: 48.14, lng: 11.58, tier: "mid" },
    { name: "Cologne", lat: 50.94, lng: 6.96, tier: "mid" },
  ],
  Spain: [
    { name: "Madrid", lat: 40.42, lng: -3.7, tier: "large" },
    { name: "Barcelona", lat: 41.39, lng: 2.17, tier: "large" },
    { name: "Valencia", lat: 39.47, lng: -0.38, tier: "mid" },
    { name: "Seville", lat: 37.39, lng: -5.99, tier: "mid" },
  ],
  Italy: [
    { name: "Rome", lat: 41.9, lng: 12.5, tier: "large" },
    { name: "Milan", lat: 45.46, lng: 9.19, tier: "large" },
    { name: "Naples", lat: 40.85, lng: 14.27, tier: "mid" },
    { name: "Turin", lat: 45.07, lng: 7.69, tier: "mid" },
  ],
  Netherlands: [
    { name: "Amsterdam", lat: 52.37, lng: 4.9, tier: "mid" },
    { name: "Rotterdam", lat: 51.92, lng: 4.48, tier: "mid" },
    { name: "The Hague", lat: 52.08, lng: 4.31, tier: "mid" },
  ],
  Sweden: [
    { name: "Stockholm", lat: 59.33, lng: 18.07, tier: "mid" },
    { name: "Gothenburg", lat: 57.71, lng: 11.97, tier: "mid" },
  ],
  Poland: [
    { name: "Warsaw", lat: 52.23, lng: 21.01, tier: "large" },
    { name: "Krakow", lat: 50.06, lng: 19.94, tier: "mid" },
    { name: "Lodz", lat: 51.76, lng: 19.46, tier: "mid" },
  ],
  "Czech Republic": [
    { name: "Prague", lat: 50.09, lng: 14.42, tier: "mid" },
    { name: "Brno", lat: 49.2, lng: 16.61, tier: "mid" },
  ],
  Romania: [
    { name: "Bucharest", lat: 44.43, lng: 26.1, tier: "large" },
    { name: "Cluj-Napoca", lat: 46.77, lng: 23.6, tier: "mid" },
  ],
  India: [
    { name: "Mumbai", lat: 19.08, lng: 72.88, tier: "mega" },
    { name: "Delhi", lat: 28.7, lng: 77.1, tier: "mega" },
    { name: "Bangalore", lat: 12.97, lng: 77.59, tier: "mega" },
    { name: "Ahmedabad", lat: 23.02, lng: 72.57, tier: "large" },
    { name: "Chennai", lat: 13.08, lng: 80.27, tier: "large" },
    { name: "Kolkata", lat: 22.57, lng: 88.36, tier: "large" },
    { name: "Hyderabad", lat: 17.39, lng: 78.49, tier: "large" },
    { name: "Pune", lat: 18.52, lng: 73.86, tier: "large" },
    { name: "Surat", lat: 21.17, lng: 72.83, tier: "mid" },
    { name: "Jaipur", lat: 26.91, lng: 75.79, tier: "mid" },
  ],
  Egypt: [
    { name: "Cairo", lat: 30.04, lng: 31.24, tier: "mega" },
    { name: "Alexandria", lat: 31.2, lng: 29.92, tier: "large" },
    { name: "Giza", lat: 30.01, lng: 31.21, tier: "large" },
  ],
  Nigeria: [
    { name: "Lagos", lat: 6.52, lng: 3.38, tier: "mega" },
    { name: "Kano", lat: 12.0, lng: 8.52, tier: "large" },
    { name: "Abuja", lat: 9.08, lng: 7.4, tier: "mid" },
  ],
  Kenya: [
    { name: "Nairobi", lat: -1.29, lng: 36.82, tier: "large" },
    { name: "Mombasa", lat: -4.04, lng: 39.66, tier: "mid" },
  ],
  "South Africa": [
    { name: "Johannesburg", lat: -26.2, lng: 28.05, tier: "large" },
    { name: "Cape Town", lat: -33.92, lng: 18.42, tier: "large" },
    { name: "Durban", lat: -29.86, lng: 31.02, tier: "mid" },
  ],
  Philippines: [
    { name: "Manila", lat: 14.6, lng: 120.98, tier: "mega" },
    { name: "Quezon City", lat: 14.68, lng: 121.04, tier: "large" },
    { name: "Davao", lat: 7.19, lng: 125.46, tier: "mid" },
  ],
  Vietnam: [
    { name: "Ho Chi Minh City", lat: 10.82, lng: 106.63, tier: "large" },
    { name: "Hanoi", lat: 21.03, lng: 105.85, tier: "large" },
  ],
  Indonesia: [
    { name: "Jakarta", lat: -6.21, lng: 106.85, tier: "mega" },
    { name: "Surabaya", lat: -7.25, lng: 112.75, tier: "large" },
    { name: "Bandung", lat: -6.92, lng: 107.62, tier: "mid" },
  ],
  "South Korea": [
    { name: "Seoul", lat: 37.57, lng: 126.98, tier: "mega" },
    { name: "Busan", lat: 35.18, lng: 129.08, tier: "large" },
  ],
  Japan: [
    { name: "Tokyo", lat: 35.68, lng: 139.65, tier: "mega" },
    { name: "Osaka", lat: 34.69, lng: 135.5, tier: "large" },
    { name: "Nagoya", lat: 35.18, lng: 136.91, tier: "mid" },
  ],
  China: [
    { name: "Shanghai", lat: 31.23, lng: 121.47, tier: "mega" },
    { name: "Beijing", lat: 39.9, lng: 116.41, tier: "mega" },
    { name: "Guangzhou", lat: 23.13, lng: 113.26, tier: "large" },
    { name: "Shenzhen", lat: 22.54, lng: 114.06, tier: "large" },
    { name: "Chengdu", lat: 30.57, lng: 104.07, tier: "large" },
  ],
  Taiwan: [
    { name: "Taipei", lat: 25.03, lng: 121.57, tier: "large" },
    { name: "Kaohsiung", lat: 22.63, lng: 120.3, tier: "mid" },
  ],
  Colombia: [
    { name: "Bogota", lat: 4.71, lng: -74.07, tier: "large" },
    { name: "Medellin", lat: 6.25, lng: -75.56, tier: "mid" },
    { name: "Cali", lat: 3.45, lng: -76.53, tier: "mid" },
  ],
  Peru: [
    { name: "Lima", lat: -12.05, lng: -77.04, tier: "large" },
    { name: "Arequipa", lat: -16.41, lng: -71.54, tier: "mid" },
  ],
  Argentina: [
    { name: "Buenos Aires", lat: -34.6, lng: -58.38, tier: "mega" },
    { name: "Cordoba", lat: -31.42, lng: -64.18, tier: "mid" },
    { name: "Rosario", lat: -32.95, lng: -60.64, tier: "mid" },
  ],
  Chile: [
    { name: "Santiago", lat: -33.45, lng: -70.67, tier: "large" },
    { name: "Valparaiso", lat: -33.05, lng: -71.61, tier: "mid" },
  ],
  Israel: [
    { name: "Tel Aviv", lat: 32.08, lng: 34.78, tier: "mid" },
    { name: "Jerusalem", lat: 31.77, lng: 35.21, tier: "mid" },
    { name: "Haifa", lat: 32.79, lng: 34.99, tier: "mid" },
  ],
  "United Arab Emirates": [
    { name: "Dubai", lat: 25.2, lng: 55.27, tier: "mid" },
    { name: "Abu Dhabi", lat: 24.45, lng: 54.38, tier: "mid" },
  ],
  "Saudi Arabia": [
    { name: "Riyadh", lat: 24.71, lng: 46.68, tier: "large" },
    { name: "Jeddah", lat: 21.49, lng: 39.19, tier: "large" },
    { name: "Mecca", lat: 21.39, lng: 39.86, tier: "mid" },
  ],
  Bangladesh: [
    { name: "Dhaka", lat: 23.81, lng: 90.41, tier: "mega" },
    { name: "Chittagong", lat: 22.36, lng: 91.78, tier: "large" },
  ],
  "Sri Lanka": [
    { name: "Colombo", lat: 6.93, lng: 79.85, tier: "mid" },
    { name: "Kandy", lat: 7.29, lng: 80.63, tier: "mid" },
  ],
  Pakistan: [
    { name: "Karachi", lat: 24.86, lng: 67.01, tier: "mega" },
    { name: "Lahore", lat: 31.55, lng: 74.34, tier: "large" },
    { name: "Islamabad", lat: 33.68, lng: 73.05, tier: "mid" },
    { name: "Faisalabad", lat: 31.42, lng: 73.08, tier: "mid" },
  ],
  Australia: [
    { name: "Sydney", lat: -33.87, lng: 151.21, tier: "large" },
    { name: "Melbourne", lat: -37.81, lng: 144.96, tier: "large" },
    { name: "Brisbane", lat: -27.47, lng: 153.02, tier: "mid" },
    { name: "Perth", lat: -31.95, lng: 115.86, tier: "mid" },
  ],
};

const TIER_POPULATION_RANGE: Record<CityAnchor["tier"], [number, number]> = {
  mega: [3_000_000, 15_000_000],
  large: [800_000, 3_000_000],
  mid: [200_000, 800_000],
};

// Point density is derived from each country's actual bounding-box area
// rather than a hand-picked number per country — a fixed guess (the
// original approach here) badly under-covers large countries: scattering
// ~220 points across the US's ~5,000,000 sq mi means the average gap
// between points is 100+ miles, so a 50-mile-radius search around a real
// site has well under even odds of hitting a single point, and the Site
// Map silently shows 0 patients everywhere — not a display bug, a density
// bug. This targets a fixed expected number of points inside a 50-mile
// search radius (the feature's default/typical radius) for EVERY country,
// large or small, so radius search reliably returns a plausible non-zero
// number of catchment points regardless of the country's size.
const MILES_PER_DEGREE_LAT = 69;
const DEFAULT_RADIUS_MILES = 50;
const TARGET_EXPECTED_HITS_AT_DEFAULT_RADIUS = 20;
const DEFAULT_RADIUS_AREA_SQMI =
  Math.PI * DEFAULT_RADIUS_MILES * DEFAULT_RADIUS_MILES;
const TARGET_AREA_PER_POINT_SQMI =
  DEFAULT_RADIUS_AREA_SQMI / TARGET_EXPECTED_HITS_AT_DEFAULT_RADIUS;
const MIN_POINTS_PER_COUNTRY = 60;
const MAX_POINTS_PER_COUNTRY = 20000;

function milesPerDegreeLngAt(midLatDeg: number): number {
  return MILES_PER_DEGREE_LAT * Math.cos((midLatDeg * Math.PI) / 180);
}

function estimatedBoxAreaSqMi(box: CountryBoundingBox): number {
  const midLat = (box.minLat + box.maxLat) / 2;
  const heightMiles = (box.maxLat - box.minLat) * MILES_PER_DEGREE_LAT;
  const widthMiles = (box.maxLng - box.minLng) * milesPerDegreeLngAt(midLat);
  return Math.max(1, heightMiles * widthMiles);
}

function pointCountFor(box: CountryBoundingBox): number {
  const raw = Math.round(
    estimatedBoxAreaSqMi(box) / TARGET_AREA_PER_POINT_SQMI,
  );
  return Math.min(
    MAX_POINTS_PER_COUNTRY,
    Math.max(MIN_POINTS_PER_COUNTRY, raw),
  );
}

// Deterministic string -> PRNG (mulberry32-style) so the synthetic dataset
// is stable across process restarts instead of regenerating differently
// every boot — a flickering patient count on every server restart would be
// worse than a wrong-but-stable one.
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

let cache: SyntheticPostalRegion[] | null = null;

/**
 * Builds (once per process, then caches) a large synthetic catchment-area
 * dataset — density scaled to each country's real area (see pointCountFor
 * above) so a default 50-mile radius search reliably hits multiple points
 * everywhere, not just by luck in smaller countries — standing in for real
 * zip/postal-level population data, which has no live public source at
 * this granularity.
 */
export function getAllSyntheticPostalRegions(): SyntheticPostalRegion[] {
  if (cache) return cache;
  const out: SyntheticPostalRegion[] = [];
  for (const box of COUNTRY_BOUNDING_BOXES) {
    const rand = seededRandom(`postal-regions|${box.country}`);
    const anchors = CITY_ANCHORS[box.country] ?? [];

    // Place the named real-city anchors first, each with a small (~1-2 mile)
    // jitter so repeated points don't all collapse onto one literal
    // coordinate. This is what makes a search near an actual major city
    // reliably return a large number instead of it being luck of the draw
    // — see the CITY_ANCHORS comment above for why this exists.
    anchors.forEach((anchor, index) => {
      const [lo, hi] = TIER_POPULATION_RANGE[anchor.tier];
      const population = Math.round(lo + rand() * (hi - lo));
      const jitterLat = (rand() - 0.5) * 0.04;
      const jitterLng = (rand() - 0.5) * 0.04;
      out.push({
        id: `SYN-${box.country.slice(0, 3).toUpperCase()}-CITY-${index.toString().padStart(2, "0")}`,
        country: box.country,
        lat: Math.round((anchor.lat + jitterLat) * 10000) / 10000,
        lng: Math.round((anchor.lng + jitterLng) * 10000) / 10000,
        population,
      });
    });

    // Fill the rest of this country's point budget with the same uniform
    // random scatter as before (mostly small towns/suburbs), minus the
    // points already spent on named-city anchors above. A small residual
    // chance of an unlisted "secondary city" bump remains, at a lower rate
    // than before now that the biggest cities are anchored explicitly.
    const pointCount = Math.max(0, pointCountFor(box) - anchors.length);
    for (let i = 0; i < pointCount; i++) {
      const lat = box.minLat + rand() * (box.maxLat - box.minLat);
      const lng = box.minLng + rand() * (box.maxLng - box.minLng);
      const isSecondaryUrban = rand() < 0.03;
      const population = isSecondaryUrban
        ? Math.round(100_000 + rand() * 700_000)
        : Math.round(2_000 + rand() * 120_000);
      out.push({
        id: `SYN-${box.country.slice(0, 3).toUpperCase()}-${i.toString().padStart(4, "0")}`,
        country: box.country,
        lat: Math.round(lat * 10000) / 10000,
        lng: Math.round(lng * 10000) / 10000,
        population,
      });
    }
  }
  cache = out;
  return out;
}

export function getSyntheticPostalRegionsForCountry(
  country: string,
): SyntheticPostalRegion[] {
  const key = country.trim().toLowerCase();
  return getAllSyntheticPostalRegions().filter(
    (r) => r.country.toLowerCase() === key,
  );
}

export const SYNTHETIC_DATA_COUNTRIES = COUNTRY_BOUNDING_BOXES.map(
  (b) => b.country,
);
