import { randomUUID } from "node:crypto";
import type { PipelineInput, RankedSite, RegionRow } from "../types.js";

/**
 * Short-lived server-side cache of one runSiteAnalysis() call's fully-scored
 * candidate pool (Stage 7's `ranked`), keyed by a random analysisId handed
 * back to the frontend in the Stage 8 payload (see finalResult.ts).
 *
 * Why this exists: the Final Recommendation page's status dropdown ("best
 * of Recruiting / Not Yet Recruiting / Active, Not Recruiting" — see
 * components/recommendation/RecommendationPanel.tsx) needs to generate a
 * fresh AI recommendation for whichever status the user picks, without
 * re-running Stages 4-6 (live ClinicalTrials.gov calls + LLM KPI/risk
 * estimation) — that data doesn't change per status, only which site in the
 * already-computed pool gets picked as "top" does. Caching `ranked` here
 * lets POST /api/site-recommendation-by-status (siteRecommendation.controller.ts)
 * do just the cheap part again: pick the best site for that status and make
 * one LLM call for its narrative.
 */
interface CachedAnalysis {
  input: PipelineInput;
  topRegion: RegionRow;
  estimatedPatients: number;
  ranked: RankedSite[];
}

interface CacheEntry extends CachedAnalysis {
  expiresAt: number;
}

// Long enough for a user to sit on Final Recommendation switching statuses
// a few times; short enough that a long-idle tab doesn't hold live-scored
// data (and the risk/score inputs behind it) around indefinitely.
const TTL_MS = 30 * 60 * 1000;
// Backstop against unbounded growth if entries are never revisited/expired
// fast enough (e.g. a burst of runs). A lookup against an evicted id just
// 404s and the frontend shows a "switch country to refresh" message — see
// RecommendationPanel.tsx's statusError handling.
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
    // Map preserves insertion order — the first key is the oldest entry.
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
