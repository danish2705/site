import { config } from "../config.js";
import type { LatLng } from "./geo.service.js";
const STATS_URL = "https://api.worldpop.org/v1/services/stats";
const TASK_URL = "https://api.worldpop.org/v1/tasks";
const DATASET = "wpgppop";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}
function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function warn(label: string, err: unknown): void {
  console.warn(`[worldpop] ${label}:`, (err as Error)?.message ?? err);
}

function circlePolygon(origin: LatLng, radiusMiles: number, points = 32) {
  const earthRadiusMiles = 3958.8;
  const latRad = (origin.lat * Math.PI) / 180;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusMiles / earthRadiusMiles) * Math.cos(angle);
    const dLng =
      ((radiusMiles / earthRadiusMiles) * Math.sin(angle)) /
      Math.cos(latRad);
    const lat = origin.lat + (dLat * 180) / Math.PI;
    const lng = origin.lng + (dLng * 180) / Math.PI;
    coords.push([lng, lat]);
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "Polygon" as const,
          coordinates: [coords],
        },
      },
    ],
  };
}

interface StatsResponse {
  status: "created" | "finished" | "started" | "error" | string;
  status_code: number;
  error: boolean;
  error_message: string | null;
  taskid?: string;
  data?: { total_population?: number };
}

async function fetchJson(url: string): Promise<StatsResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    config.worldPop.timeoutMs,
  );
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      warn(`HTTP ${res.status} from ${url}`, null);
      return null;
    }
    return (await res.json()) as StatsResponse;
  } catch (err) {
    warn(`request failed for ${url}`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function pollTask(taskid: string): Promise<number | null> {
  for (let attempt = 0; attempt < config.worldPop.maxPollAttempts; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, config.worldPop.pollIntervalMs),
    );
    const result = await fetchJson(`${TASK_URL}/${taskid}`);
    if (!result) continue;
    if (result.error) {
      warn(`task ${taskid} errored`, result.error_message);
      return null;
    }
    if (result.status === "finished") {
      return typeof result.data?.total_population === "number"
        ? result.data.total_population
        : null;
    }
  }
  warn(`task ${taskid} did not finish within poll budget`, null);
  return null;
}

export interface WorldPopPopulationResult {
  populationInRadius: number;
  source: "worldpop-live";
  citation: string;
}

export async function getPopulationInRadius(
  origin: LatLng,
  radiusMiles: number,
): Promise<WorldPopPopulationResult | null> {
  const year = config.worldPop.datasetYear;
  const cacheKey = `${origin.lat.toFixed(3)}|${origin.lng.toFixed(3)}|${Math.round(radiusMiles)}|${year}`;
  const cached = getCached<WorldPopPopulationResult>(cacheKey);
  if (cached) return cached;

  try {
    const geojson = circlePolygon(origin, radiusMiles);
    const params = new URLSearchParams({
      dataset: DATASET,
      year: String(year),
      geojson: JSON.stringify(geojson),
      runasync: "false",
    });
    if (config.worldPop.apiKey) params.set("key", config.worldPop.apiKey);

    let result = await fetchJson(`${STATS_URL}?${params.toString()}`);
    if (!result) return null;
    if (result.error) {
      warn("stats query errored", result.error_message);
      return null;
    }

    let totalPopulation: number | null = null;
    if (result.status === "finished") {
      totalPopulation =
        typeof result.data?.total_population === "number"
          ? result.data.total_population
          : null;
    } else if (result.status === "created" && result.taskid) {
      totalPopulation = await pollTask(result.taskid);
    }

    if (totalPopulation === null || !Number.isFinite(totalPopulation)) {
      return null;
    }

    const out: WorldPopPopulationResult = {
      populationInRadius: Math.round(totalPopulation),
      source: "worldpop-live",
      citation: `WorldPop (www.worldpop.org), Global per-country ${year} population grid — total population within a ${Math.round(radiusMiles)}-mile radius.`,
    };
    setCached(cacheKey, out, config.worldPop.cacheTtlMs);
    return out;
  } catch (err) {
    warn("getPopulationInRadius failed", err);
    return null;
  }
}
