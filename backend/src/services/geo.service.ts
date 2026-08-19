import { config } from "../config.js";

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

const NOMINATIM_USER_AGENT = `bousch-clinical-trial-site-finder/1.0${
  config.geo.contactEmail ? ` (contact: ${config.geo.contactEmail})` : ""
}`;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const geocodeCache = new Map<string, CacheEntry<GeocodeResult>>();
const distanceCache = new Map<string, CacheEntry<DistanceResult>>();

let nominatimQueueTail: Promise<void> = Promise.resolve();
let lastNominatimCallAt = 0;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
function scheduleOnNominatimQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimQueueTail.then(async () => {
    const wait = lastNominatimCallAt + NOMINATIM_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCallAt = Date.now();
    return fn();
  });
  // Keep chaining even if this call fails, so one bad lookup doesn't wedge
  // every geocode call behind it forever.
  nominatimQueueTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export interface DistanceResult {
  miles: number;
  source: "live-google" | "live-osrm" | "approximate-haversine";
}

function distanceCacheKey(origin: LatLng, destination: LatLng): string {
  const r = (n: number) => n.toFixed(3);
  return `${r(origin.lat)},${r(origin.lng)}|${r(destination.lat)},${r(destination.lng)}`;
}

export async function getDistanceMiles(
  origin: LatLng,
  destination: LatLng,
): Promise<DistanceResult> {
  const cacheKey = distanceCacheKey(origin, destination);
  const cached = distanceCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const cacheAndReturn = (value: DistanceResult): DistanceResult => {
    distanceCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  };

  if (config.google.mapsApiKey) {
    try {
      const url = new URL(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
      );
      url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
      url.searchParams.set(
        "destinations",
        `${destination.lat},${destination.lng}`,
      );
      url.searchParams.set("units", "imperial");
      url.searchParams.set("key", config.google.mapsApiKey);
      const res = await fetch(url.toString());
      const body = (await res.json()) as {
        rows?: {
          elements?: { status: string; distance?: { value: number } }[];
        }[];
      };
      const element = body.rows?.[0]?.elements?.[0];
      if (element?.status === "OK" && typeof element.distance?.value === "number") {
        return cacheAndReturn({
          miles: element.distance.value / 1609.34,
          source: "live-google",
        });
      }
    } catch {
      // Fall through to the free tier below — a network/API hiccup should
      // never break the map, just make it less precise.
    }
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=false`;
    const res = await fetch(url);
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number }[];
    };
    if (body.code === "Ok" && typeof body.routes?.[0]?.distance === "number") {
      return cacheAndReturn({
        miles: body.routes[0].distance / 1609.34,
        source: "live-osrm",
      });
    }
  } catch {
    // Fall through to the approximation below.
  }

  return cacheAndReturn({
    miles: haversineMiles(origin, destination) * 1.2,
    source: "approximate-haversine",
  });
}

// Google's Distance Matrix accepts many destinations per origin in one call
// (billed per element, i.e. per origin x destination pair) — well under its
// per-request cap, this keeps a whole site's catchment check to a handful of
// requests instead of one request per candidate point.
const GOOGLE_BATCH_DESTINATIONS = 25;

/**
 * Real driving distance from one origin to MANY destinations, batched to
 * stay cheap even when checking dozens of candidate catchment points per
 * site. Same fallback chain as getDistanceMiles (Google Distance Matrix ->
 * OSRM -> haversine approximation), but OSRM's free /table endpoint (a
 * proper many-to-one matrix, not one /route call per destination) is used
 * for the free tier instead of looping getDistanceMiles per destination —
 * looping would multiply this function's whole reason for existing (keeping
 * request counts low) right back out again.
 *
 * Callers should still pre-filter `destinations` down to a plausible
 * candidate set (e.g. via a widened haversine radius) before calling this —
 * see config.map.catchmentPrefilterFactor — rather than passing every point
 * in a country and relying on this function alone to keep costs down.
 */
export async function getDistancesMilesBatch(
  origin: LatLng,
  destinations: LatLng[],
): Promise<DistanceResult[]> {
  const results: (DistanceResult | undefined)[] = new Array(
    destinations.length,
  );

  const pending: { index: number; dest: LatLng }[] = [];
  destinations.forEach((dest, index) => {
    const cached = distanceCache.get(distanceCacheKey(origin, dest));
    if (cached && Date.now() < cached.expiresAt) {
      results[index] = cached.value;
    } else {
      pending.push({ index, dest });
    }
  });

  const remember = (dest: LatLng, value: DistanceResult) => {
    distanceCache.set(distanceCacheKey(origin, dest), {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  };

  if (pending.length > 0 && config.google.mapsApiKey) {
    for (let i = 0; i < pending.length; i += GOOGLE_BATCH_DESTINATIONS) {
      const chunk = pending.slice(i, i + GOOGLE_BATCH_DESTINATIONS);
      try {
        const url = new URL(
          "https://maps.googleapis.com/maps/api/distancematrix/json",
        );
        url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
        url.searchParams.set(
          "destinations",
          chunk.map((c) => `${c.dest.lat},${c.dest.lng}`).join("|"),
        );
        url.searchParams.set("units", "imperial");
        url.searchParams.set("key", config.google.mapsApiKey);
        const res = await fetch(url.toString());
        const body = (await res.json()) as {
          rows?: {
            elements?: { status: string; distance?: { value: number } }[];
          }[];
        };
        const elements = body.rows?.[0]?.elements ?? [];
        chunk.forEach((c, j) => {
          const el = elements[j];
          if (el?.status === "OK" && typeof el.distance?.value === "number") {
            const value: DistanceResult = {
              miles: el.distance.value / 1609.34,
              source: "live-google",
            };
            results[c.index] = value;
            remember(c.dest, value);
          }
        });
      } catch {
        // This chunk's elements stay unresolved — the OSRM/haversine tiers
        // below still get a chance at them individually.
      }
    }
  }

  const stillPending = pending.filter((p) => !results[p.index]);
  if (stillPending.length > 0) {
    try {
      // OSRM's /table service: one origin (source index 0), many
      // destinations, one HTTP call — a real many-to-one driving-distance
      // matrix, not this function looping single /route calls.
      const coordList = [origin, ...stillPending.map((p) => p.dest)]
        .map((p) => `${p.lng},${p.lat}`)
        .join(";");
      const destIndexes = stillPending.map((_, j) => j + 1).join(";");
      const url =
        `https://router.project-osrm.org/table/v1/driving/${coordList}` +
        `?sources=0&destinations=${destIndexes}&annotations=distance`;
      const res = await fetch(url);
      const body = (await res.json()) as {
        code: string;
        distances?: (number | null)[][];
      };
      if (body.code === "Ok" && body.distances?.[0]) {
        const row = body.distances[0];
        stillPending.forEach((p, j) => {
          const meters = row[j];
          if (typeof meters === "number") {
            const value: DistanceResult = {
              miles: meters / 1609.34,
              source: "live-osrm",
            };
            results[p.index] = value;
            remember(p.dest, value);
          }
        });
      }
    } catch {
      // Fall through to the approximation below for anything still unresolved.
    }
  }

  return destinations.map((dest, index) => {
    const existing = results[index];
    if (existing) return existing;
    const value: DistanceResult = {
      miles: haversineMiles(origin, dest) * 1.2,
      source: "approximate-haversine",
    };
    remember(dest, value);
    return value;
  });
}

export interface GeocodeResult {
  point: LatLng;
  source: "live-google" | "live-nominatim" | "approximate";
}

// Real, approximate country centroids (public geography) used only as the
// jitter anchor for the deterministic last-resort fallback.
const COUNTRY_CENTROIDS: Record<string, LatLng> = {
  "united states": { lat: 39.8, lng: -98.6 },
  canada: { lat: 56.1, lng: -106.3 },
  "united kingdom": { lat: 54.0, lng: -2.5 },
  france: { lat: 46.6, lng: 2.5 },
  germany: { lat: 51.2, lng: 10.5 },
  spain: { lat: 40.0, lng: -3.7 },
  italy: { lat: 42.8, lng: 12.6 },
  netherlands: { lat: 52.1, lng: 5.3 },
  sweden: { lat: 60.1, lng: 18.6 },
  poland: { lat: 51.9, lng: 19.1 },
  "czech republic": { lat: 49.8, lng: 15.5 },
  romania: { lat: 45.9, lng: 24.9 },
  india: { lat: 22.9, lng: 79.0 },
  egypt: { lat: 26.8, lng: 30.8 },
  nigeria: { lat: 9.1, lng: 8.7 },
  kenya: { lat: -0.02, lng: 37.9 },
  "south africa": { lat: -30.6, lng: 22.9 },
  philippines: { lat: 12.9, lng: 121.8 },
  vietnam: { lat: 14.1, lng: 108.3 },
  indonesia: { lat: -0.8, lng: 113.9 },
  "south korea": { lat: 35.9, lng: 127.8 },
  japan: { lat: 36.2, lng: 138.3 },
  china: { lat: 35.9, lng: 104.2 },
  taiwan: { lat: 23.7, lng: 121.0 },
  colombia: { lat: 4.6, lng: -74.3 },
  peru: { lat: -9.2, lng: -75.0 },
  argentina: { lat: -38.4, lng: -63.6 },
  chile: { lat: -35.7, lng: -71.5 },
  israel: { lat: 31.0, lng: 34.9 },
  "united arab emirates": { lat: 23.4, lng: 53.8 },
  "saudi arabia": { lat: 23.9, lng: 45.1 },
  bangladesh: { lat: 23.7, lng: 90.4 },
  "sri lanka": { lat: 7.9, lng: 80.8 },
  pakistan: { lat: 30.4, lng: 69.3 },
  australia: { lat: -25.3, lng: 133.8 },
};

function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Best-effort site coordinates, in priority order: Google Geocoding (if
 * GOOGLE_MAPS_API_KEY is set) -> OpenStreetMap's Nominatim (free, no
 * signup/key/card, but rate-limited to ~1 request/second — see the queue
 * above) -> a deterministic hash-based point near the country's centroid,
 * jittered by city+state so the same facility always lands in the same
 * spot rather than moving around on every request. ALWAYS tagged with
 * `source` so callers/UI know which tier produced it.
 */
export async function geocodeApprox(
  city: string | null,
  state: string | null,
  country: string,
): Promise<GeocodeResult> {
  const address = [city, state, country].filter(Boolean).join(", ");
  const cacheKey = address.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const cacheAndReturn = (value: GeocodeResult): GeocodeResult => {
    geocodeCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  };

  if (config.google.mapsApiKey) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", address);
      url.searchParams.set("key", config.google.mapsApiKey);
      const res = await fetch(url.toString());
      const body = (await res.json()) as {
        status: string;
        results?: { geometry?: { location?: { lat: number; lng: number } } }[];
      };
      const loc = body.results?.[0]?.geometry?.location;
      if (body.status === "OK" && loc) {
        return cacheAndReturn({
          point: { lat: loc.lat, lng: loc.lng },
          source: "live-google",
        });
      }
    } catch {
      // Fall through to the free tier below.
    }
  }

  // Free tier: OpenStreetMap Nominatim. Real geocoding, no signup/key/card
  // — throttled to its ~1 request/second free-use policy via the queue
  // above, and identified with a real User-Agent as that policy requires.
  try {
    const result = await scheduleOnNominatimQueue(async () => {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", address);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": NOMINATIM_USER_AGENT },
      });
      const body = (await res.json()) as { lat: string; lon: string }[];
      const hit = Array.isArray(body) ? body[0] : undefined;
      if (!hit) return null;
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { point: { lat, lng }, source: "live-nominatim" as const };
    });
    if (result) return cacheAndReturn(result);
  } catch {
    // Fall through to the deterministic approximation below.
  }

  const centroid =
    COUNTRY_CENTROIDS[country.trim().toLowerCase()] ?? { lat: 20, lng: 0 };
  const seed = `${city ?? ""}|${state ?? ""}|${country}`;
  const jitterLat = (seededUnit(`${seed}|lat`) - 0.5) * 6; // +/- ~3 degrees
  const jitterLng = (seededUnit(`${seed}|lng`) - 0.5) * 6;
  return cacheAndReturn({
    point: { lat: centroid.lat + jitterLat, lng: centroid.lng + jitterLng },
    source: "approximate",
  });
}
