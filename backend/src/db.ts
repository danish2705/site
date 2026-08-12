import pg from "pg";
import { config } from "./config.js";

pg.types.setTypeParser(1700, (value: string | null) =>
  value === null ? null : parseFloat(value),
);

const connectionString = config.databaseUrl;

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

/** The pool, or a clear error if persistence was never configured. */

export function requirePool(): pg.Pool {
  if (!pool) {
    throw new Error(
      "Saving is not configured — DATABASE_URL is not set. Add it to backend/.env and restart.",
    );
  }
  return pool;
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
