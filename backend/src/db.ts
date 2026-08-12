import pg from "pg";
import { config } from "./config.js";

pg.types.setTypeParser(1700, (value: string | null) =>
  value === null ? null : parseFloat(value),
);

const connectionString = config.databaseUrl;

const pool: pg.Pool | null = connectionString
  ? new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

pool?.on("error", (err) => {
  console.error("[db] idle client error (will be recycled):", err.message);
});

export function dbStatus(): { configured: boolean; reason?: string } {
  return pool
    ? { configured: true }
    : { configured: false, reason: "DATABASE_URL is not set" };
}

export function requirePool(): pg.Pool {
  if (!pool) {
    throw new Error(
      "Saving is not configured — DATABASE_URL is not set. Add it to backend/.env and restart.",
    );
  }
  return pool;
}

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
