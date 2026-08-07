/**
 * db.ts — saved pipeline runs, over a direct Postgres connection.
 *
 * WHY pg AND NOT @supabase/supabase-js
 * ------------------------------------
 * supabase-js talks to the REST API over HTTP using Node's built-in fetch.
 * Node's fetch does NOT honour HTTP_PROXY / HTTPS_PROXY, so on a corporate
 * network where outbound HTTPS must go through a proxy it fails with a bare
 * "TypeError: fetch failed" — even though curl and the browser work fine,
 * because those do use the proxy. This connects to Postgres over TCP
 * instead, sidestepping the HTTP proxy entirely.
 *
 * The other win: real transactions. The supabase-js version had to do two
 * inserts and manually delete the parent row if the second failed, because
 * the JS client has no transaction API. Here saveRun() is a genuine
 * BEGIN/COMMIT, so a partial save is impossible.
 *
 * .env (never commit it):
 *   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * From Dashboard > Connect > Connection string. Use the POOLER host
 * (port 6543), not db.<ref>.supabase.co:5432 — direct connections are
 * IPv6-only on the free tier and fail on most corporate networks.
 *
 * Persistence is OPTIONAL. With no DATABASE_URL the app runs exactly as
 * before and the Save button reports saving is unavailable, rather than the
 * server failing to boot.
 */

import pg from "pg";
import type { RiskLevel } from "./types.js";

// node-postgres returns NUMERIC/DECIMAL columns as strings by default (it
// won't silently risk precision loss converting them to JS numbers). Every
// score column here (score, recruitment_score, quality_score, ...) is
// NUMERIC, so without this every one of them comes back as "67.00" instead
// of 67 — which the frontend's SavedRunDetail/SavedRunSite types declare as
// `number | null` and then call .toFixed()/do math on, crashing with
// "value.toFixed is not a function" the moment a saved run is opened.
// Parsing OID 1700 (numeric) as a float here fixes it for every query
// through this pool, not just the ones this file already knows about.
pg.types.setTypeParser(1700, (value: string | null) =>
  value === null ? null : parseFloat(value),
);

const connectionString = process.env.DATABASE_URL;

// Port 6543 is pgBouncer in transaction mode. node-postgres sends unnamed
// statements by default so it works there as-is — but do not introduce
// named prepared statements, which transaction pooling does not support.
const pool: pg.Pool | null = connectionString
  ? new pg.Pool({
      connectionString,
      // Supabase's pooler presents a cert this chain doesn't verify by
      // default. The connection is still encrypted, just not pinned.
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      // Fail fast with a clear error instead of hanging ~2 minutes when a
      // firewall silently drops the connection.
      connectionTimeoutMillis: 10_000,
    })
  : null;

// A pool emits 'error' for idle clients dropped by the server. Unhandled,
// that event crashes the process — pgBouncer recycles idle connections
// routinely, so this WILL fire in normal operation.
pool?.on("error", (err) => {
  console.error("[db] idle client error (will be recycled):", err.message);
});

export function dbStatus(): { configured: boolean; reason?: string } {
  return pool
    ? { configured: true }
    : { configured: false, reason: "DATABASE_URL is not set" };
}

function requirePool(): pg.Pool {
  if (!pool) {
    throw new Error(
      "Saving is not configured — DATABASE_URL is not set. Add it to backend/.env and restart.",
    );
  }
  return pool;
}

// ---------------------------------------------------------------- shapes

/** Per-component scores. null = no data, component dropped from weighting. */
export interface SavedComponents {
  recruitment: number | null;
  quality: number | null;
  retention: number | null;
  diversity: number | null;
  cost: number | null;
}

export interface SavedSite {
  rank: number;
  siteId: string;
  siteName: string;
  region: string;
  score: number;
  components: SavedComponents;
  confidence: string;
  caveats: string[];
  meetsRequirements: boolean;
  failedCriteria: string[];
  suitabilityScore: number | null;
  riskLevel: RiskLevel;
  highRiskCount: number;
}

/** Exactly what POST /api/runs accepts. */
export interface SaveRunInput {
  label?: string;
  indication: string;
  phase?: string;
  sampleSize?: number;
  durationMonths?: number;
  budgetTier?: string;
  region?: string;
  country?: string;
  estimatedPatients?: number;
  llm?: string;
  final?: {
    recommendedSite?: string;
    siteId?: string;
    score?: number;
    confidence?: string;
    riskLevel?: RiskLevel;
    highRiskCount?: number;
    meetsRequirements?: boolean;
    text?: string;
    scoreExplanation?: string;
    requirementChecks?: unknown;
  } | null;
  ranking: SavedSite[];
}

export interface SavedRunSummary {
  id: string;
  created_at: string;
  label: string | null;
  indication: string;
  phase: string | null;
  region: string | null;
  country: string | null;
  recommended_site_name: string | null;
  score: number | null;
  confidence: string | null;
  risk_level: string | null;
  meets_requirements: boolean | null;
  ranked_site_count: number;
}

// ---------------------------------------------------------------- write

/**
 * Saves a run and its ranked sites in ONE transaction. Either both land or
 * neither does — a half-saved run is impossible.
 */
export async function saveRun(input: SaveRunInput): Promise<{ id: string }> {
  const db = requirePool();

  if (!input.indication)
    throw new Error("Cannot save a run with no indication.");
  if (!Array.isArray(input.ranking) || input.ranking.length === 0) {
    throw new Error(
      "Cannot save a run with no ranked sites — run the pipeline first.",
    );
  }

  const f = input.final ?? {};
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ id: string }>(
      `insert into trial_runs (
         label, indication, phase, sample_size, duration_months, budget_tier,
         region, country, estimated_patients,
         recommended_site_id, recommended_site_name, score, confidence,
         risk_level, high_risk_count, meets_requirements,
         recommendation_text, score_explanation, llm,
         raw_final, raw_requirements
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
       ) returning id`,
      [
        input.label?.trim() || null,
        input.indication,
        input.phase ?? null,
        input.sampleSize ?? null,
        input.durationMonths ?? null,
        input.budgetTier ?? null,
        input.region ?? null,
        input.country ?? null,
        input.estimatedPatients ?? null,
        f.siteId ?? null,
        f.recommendedSite ?? null,
        f.score ?? null,
        f.confidence ?? null,
        f.riskLevel ?? null,
        f.highRiskCount ?? null,
        f.meetsRequirements ?? null,
        f.text ?? null,
        f.scoreExplanation ?? null,
        input.llm ?? null,
        input.final ? JSON.stringify(input.final) : null,
        f.requirementChecks ? JSON.stringify(f.requirementChecks) : null,
      ],
    );

    const runId = rows[0].id;

    for (const s of input.ranking) {
      await client.query(
        `insert into trial_run_sites (
           run_id, rank, site_id, site_name, region, score,
           recruitment_score, quality_score, retention_score,
           diversity_score, cost_score,
           confidence, caveats, meets_requirements, failed_criteria,
           suitability_score, risk_level, high_risk_count
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
         )`,
        [
          runId,
          s.rank,
          s.siteId,
          s.siteName ?? null,
          s.region ?? null,
          s.score ?? null,
          // Nulls pass straight through — a component with no data is not a
          // component that scored zero, and that distinction has to survive
          // into the database.
          s.components?.recruitment ?? null,
          s.components?.quality ?? null,
          s.components?.retention ?? null,
          s.components?.diversity ?? null,
          s.components?.cost ?? null,
          s.confidence ?? null,
          s.caveats ?? [],
          s.meetsRequirements ?? null,
          s.failedCriteria ?? [],
          s.suitabilityScore ?? null,
          s.riskLevel ?? null,
          s.highRiskCount ?? null,
        ],
      );
    }

    await client.query("COMMIT");
    return { id: runId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {
      /* connection may already be dead; the original error matters more */
    });
    throw new Error(`Could not save run: ${(err as Error).message}`);
  } finally {
    // Must always run, or the pool leaks a connection per failed save and
    // eventually every request hangs waiting for a free client.
    client.release();
  }
}

// ----------------------------------------------------------------- read

export async function listRuns(limit = 50): Promise<SavedRunSummary[]> {
  const db = requirePool();
  const { rows } = await db.query<SavedRunSummary>(
    `select * from trial_runs_summary order by created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function getRun(id: string) {
  const db = requirePool();

  const { rows: runRows } = await db.query(
    `select * from trial_runs where id = $1`,
    [id],
  );
  if (runRows.length === 0) throw new Error(`No saved run with id ${id}.`);

  const { rows: sites } = await db.query(
    `select * from trial_run_sites where run_id = $1 order by rank asc`,
    [id],
  );

  return { run: runRows[0], sites };
}

export async function deleteRun(id: string): Promise<void> {
  const db = requirePool();
  // trial_run_sites has ON DELETE CASCADE, so children go with it.
  await db.query(`delete from trial_runs where id = $1`, [id]);
}

/**
 * Verifies the connection AND that the schema has been applied, so a
 * misconfiguration shows up on /api/health rather than as a mystery failure
 * on the first save.
 */
export async function dbPing(): Promise<{ ok: boolean; detail: string }> {
  if (!pool)
    return { ok: false, detail: dbStatus().reason ?? "not configured" };
  try {
    await pool.query("select 1 from trial_runs limit 1");
    return { ok: true, detail: "connected, schema present" };
  } catch (err) {
    const message = (err as Error).message;
    return {
      ok: false,
      detail: /relation .* does not exist/i.test(message)
        ? "connected, but schema.sql has not been run"
        : message,
    };
  }
}
