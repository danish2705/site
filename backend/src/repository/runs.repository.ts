import { requirePool } from "../db.js";
import type { SaveRunInput, SavedRunSummary } from "../types.js";

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
    await client.query("ROLLBACK").catch(() => {});
    throw new Error(`Could not save run: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

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
  await db.query(`delete from trial_runs where id = $1`, [id]);
}
