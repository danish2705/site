import { randomUUID } from "node:crypto";
import type { PipelineInput, RankedSite, RegionRow } from "../types.js";

interface CachedAnalysis {
  input: PipelineInput;
  topRegion: RegionRow;
  estimatedPatients: number;
  ranked: RankedSite[];
}

interface CacheEntry extends CachedAnalysis {
  expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, CacheEntry>();

function sweepExpired(): void {
  const now = Date.now();
  for (const [id, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(id);
  }
}

export function storeAnalysis(entry: CachedAnalysis): string {
  sweepExpired();
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  const id = randomUUID();
  cache.set(id, { ...entry, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getAnalysis(id: string): CachedAnalysis | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(id);
    return null;
  }
  return entry;
}
