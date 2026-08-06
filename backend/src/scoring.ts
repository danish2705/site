/**
 * scoring.ts — the deck's site-ranking model, in code.
 *
 * Slide 7 of Clinical_Trial_Site_Ranking_and_Optimization.pptx specifies:
 *
 *   Site score = 0.35(Recruitment) + 0.25(Quality) + 0.20(Retention)
 *              + 0.10(Diversity)   + 0.10(Cost)
 *
 * The workbook's existing "Suitability Score (0-100)" formula does NOT
 * implement this — it weights recruitment at 0.20 and has no Diversity or
 * Cost term at all. This module is the reconciliation, and it fixes the
 * missing-data behaviour at the same time.
 *
 * THE MISSING-DATA BUG THIS REPLACES
 * ----------------------------------
 * The Excel formula reads blank cells as 0, which biases the ranking in two
 * opposite directions at once:
 *   - A blank Data Quality Score scores 0/100 -> the site silently loses its
 *     full 15-point quality allocation.
 *   - A blank Dropout Rate hits MAX(100 - 0*5, 0) = 100 -> the site silently
 *     gains FULL retention marks for having no retention data.
 * 116 of 600 sites (19%) have at least one blank driver, so this is not an
 * edge case. Here, a component with no usable inputs is dropped and the
 * remaining weights are renormalised, so a site is scored on what is known
 * about it and the gap is reported via `completeness` / `confidence` rather
 * than being laundered into the number.
 *
 * Every sub-metric is converted to a 0-100 "higher is better" scale before
 * weighting, so a metric with a wide raw range can't dominate a narrow one.
 */

import type { EvaluationRow } from "./types.js";

// ---------------------------------------------------------------- weights

export interface ComponentWeights {
  recruitment: number;
  quality: number;
  retention: number;
  diversity: number;
  cost: number;
}

/** Slide 7. Mirrors the Scoring_Weights sheet in the workbook. */
export const DECK_WEIGHTS: ComponentWeights = {
  recruitment: 0.35,
  quality: 0.25,
  retention: 0.2,
  diversity: 0.1,
  cost: 0.1,
};

// ------------------------------------------------------------ scale helpers

/** Reads a numeric cell, treating null/undefined/NaN/"" as absent. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

/** Higher raw value is better, saturating at `best`. */
function higherBetter(v: number | null, best: number): number | null {
  return v === null ? null : clamp100((v / best) * 100);
}

/**
 * Lower raw value is better. `floor` scores 100, `ceiling` scores 0, and
 * anything between interpolates linearly.
 */
function lowerBetter(
  v: number | null,
  floor: number,
  ceiling: number,
): number | null {
  if (v === null) return null;
  if (ceiling <= floor) return 100;
  return clamp100(((ceiling - v) / (ceiling - floor)) * 100);
}

/**
 * Weighted mean over the sub-metrics that actually have a value. Returns
 * null when none do, which is what makes the parent component drop out of
 * the composite instead of contributing a fabricated zero.
 */
function blend(parts: [number | null, number][]): number | null {
  let num_ = 0;
  let den = 0;
  for (const [value, weight] of parts) {
    if (value === null) continue;
    num_ += value * weight;
    den += weight;
  }
  return den === 0 ? null : num_ / den;
}

// ------------------------------------------------------------- components

/**
 * The five component scores. Each is 0-100, or null when the site has no
 * usable data for it.
 *
 * `costPercentile` is passed in rather than derived from the row, because
 * cost is only meaningful relative to the peer set being ranked — a
 * $2,400/patient site is cheap in Boston and expensive in Chennai.
 */
export interface ComponentScores {
  recruitment: number | null;
  quality: number | null;
  retention: number | null;
  diversity: number | null;
  cost: number | null;
}

export interface ScoredSite {
  siteId: string;
  components: ComponentScores;
  /** Weighted composite, 0-100, renormalised over available components. */
  score: number;
  /** Share of the deck weighting that had data behind it, 0-100. */
  coverage: number;
  /** Share of raw KPI fields present on the evaluation row, 0-100. */
  completeness: number;
  confidence: "High" | "Medium" | "Low";
  /** Human-readable notes on what was missing, for the UI to surface. */
  caveats: string[];
}

/**
 * Extended evaluation row — the enriched workbook's Site_Evaluation columns.
 * All new fields are optional so this module still runs against the original
 * workbook, degrading to whatever data is present rather than throwing.
 */
export interface ExtendedEvaluationRow extends EvaluationRow {
  "Screen Failure Rate (%)"?: number | null;
  "Protocol Deviation Rate (per 100 visits)"?: number | null;
  "Time to FPI (days)"?: number | null;
  "Site Start-up Time (days)"?: number | null;
  "Query Rate (per 100 CRF pages)"?: number | null;
  "Query Resolution Time (days)"?: number | null;
  "Data Entry Lag (days)"?: number | null;
  "Staff Turnover (%)"?: number | null;
  "GCP Certification Current (%)"?: number | null;
  "Site Cost per Patient (USD)"?: number | null;
  "Catchment Population"?: number | null;
  "Diversity Index (0-100)"?: number | null;
}

/**
 * Thresholds for the lower-is-better metrics. Pulled out as named constants
 * rather than buried in the maths, because these are judgement calls a
 * feasibility lead will want to argue with — and should be able to.
 */
export const THRESHOLDS = {
  enrollmentRateBest: 25, // pts/month scoring 100
  screenFailure: { floor: 10, ceiling: 70 }, // %
  timeToFpi: { floor: 14, ceiling: 200 }, // days
  startUp: { floor: 21, ceiling: 220 }, // days
  queryRate: { floor: 2, ceiling: 55 }, // per 100 CRF pages
  queryResolution: { floor: 1, ceiling: 40 }, // days
  dataEntryLag: { floor: 0.5, ceiling: 35 }, // days
  protocolDeviation: { floor: 0.3, ceiling: 20 }, // per 100 visits
  dropout: { floor: 2, ceiling: 30 }, // %
  staffTurnover: { floor: 2, ceiling: 50 }, // %
};

function componentScores(
  row: ExtendedEvaluationRow,
  costPercentile: number | null,
): ComponentScores {
  const T = THRESHOLDS;

  // 1) RECRUITMENT (0.35) — can this site find and enrol the right patients?
  const recruitment = blend([
    [
      higherBetter(
        num(row["Historical Enrollment Rate (pts/month)"]),
        T.enrollmentRateBest,
      ),
      0.4,
    ],
    [
      lowerBetter(
        num(row["Screen Failure Rate (%)"]),
        T.screenFailure.floor,
        T.screenFailure.ceiling,
      ),
      0.25,
    ],
    [
      lowerBetter(
        num(row["Time to FPI (days)"]),
        T.timeToFpi.floor,
        T.timeToFpi.ceiling,
      ),
      0.2,
    ],
    [
      lowerBetter(
        num(row["Site Start-up Time (days)"]),
        T.startUp.floor,
        T.startUp.ceiling,
      ),
      0.15,
    ],
  ]);

  // 2) QUALITY (0.25) — the deck's "high query rate / delayed data entry /
  //    protocol deviation" cluster, plus the existing data quality score.
  const quality = blend([
    [num(row["Data Quality Score (0-100)"]), 0.35],
    [
      lowerBetter(
        num(row["Query Rate (per 100 CRF pages)"]),
        T.queryRate.floor,
        T.queryRate.ceiling,
      ),
      0.2,
    ],
    [
      lowerBetter(
        num(row["Query Resolution Time (days)"]),
        T.queryResolution.floor,
        T.queryResolution.ceiling,
      ),
      0.15,
    ],
    [
      lowerBetter(
        num(row["Data Entry Lag (days)"]),
        T.dataEntryLag.floor,
        T.dataEntryLag.ceiling,
      ),
      0.15,
    ],
    [
      lowerBetter(
        num(row["Protocol Deviation Rate (per 100 visits)"]),
        T.protocolDeviation.floor,
        T.protocolDeviation.ceiling,
      ),
      0.15,
    ],
  ]);

  // 3) RETENTION (0.20) — patient dropout, plus staff turnover, which the
  //    deck lists separately but which drives patient attrition in practice.
  const retention = blend([
    [
      lowerBetter(
        num(row["Dropout Rate (%)"]),
        T.dropout.floor,
        T.dropout.ceiling,
      ),
      0.65,
    ],
    [
      lowerBetter(
        num(row["Staff Turnover (%)"]),
        T.staffTurnover.floor,
        T.staffTurnover.ceiling,
      ),
      0.35,
    ],
  ]);

  // 4) DIVERSITY (0.10)
  const diversityRaw = num(row["Diversity Index (0-100)"]);
  const diversity = diversityRaw === null ? null : clamp100(diversityRaw);

  // 5) COST (0.10) — relative to the peer set; 100 = cheapest in the set.
  const cost = costPercentile === null ? null : clamp100(costPercentile);

  return { recruitment, quality, retention, diversity, cost };
}

// ------------------------------------------------------------- public API

const RAW_KPI_FIELDS: (keyof ExtendedEvaluationRow)[] = [
  "Investigator Experience Score (0-10)",
  "Years Experience",
  "Prior Trials Count",
  "Historical Enrollment Rate (pts/month)",
  "Dropout Rate (%)",
  "Staff Availability Score (0-10)",
  "Infrastructure Readiness (%)",
  "Data Quality Score (0-100)",
  "Competing Trials at Site",
  "Screen Failure Rate (%)",
  "Protocol Deviation Rate (per 100 visits)",
  "Time to FPI (days)",
  "Site Start-up Time (days)",
  "Query Rate (per 100 CRF pages)",
  "Query Resolution Time (days)",
  "Data Entry Lag (days)",
  "Staff Turnover (%)",
  "GCP Certification Current (%)",
  "Site Cost per Patient (USD)",
  "Catchment Population",
  "Diversity Index (0-100)",
];

const COMPONENT_LABEL: Record<keyof ComponentScores, string> = {
  recruitment: "Recruitment",
  quality: "Quality",
  retention: "Retention",
  diversity: "Diversity",
  cost: "Cost",
};

/**
 * Scores a whole candidate set together.
 *
 * Cost has to be scored across the set rather than per row, so this takes an
 * array. It also means the returned scores are only comparable WITHIN one
 * call — don't cache a score from one region's run and compare it to
 * another's.
 */
export function scoreSites(
  rows: ExtendedEvaluationRow[],
  weights: ComponentWeights = DECK_WEIGHTS,
): ScoredSite[] {
  // --- cost percentiles across the peer set (cheapest = 100) ---
  const costs = rows
    .map((r) => num(r["Site Cost per Patient (USD)"]))
    .filter((n): n is number => n !== null);
  const minCost = costs.length ? Math.min(...costs) : null;
  const maxCost = costs.length ? Math.max(...costs) : null;

  const costPercentileFor = (r: ExtendedEvaluationRow): number | null => {
    const c = num(r["Site Cost per Patient (USD)"]);
    if (c === null || minCost === null || maxCost === null) return null;
    // Everyone in the set costs the same -> cost carries no signal, so give
    // a neutral 50 rather than an arbitrary 0 or 100.
    if (maxCost === minCost) return 50;
    return ((maxCost - c) / (maxCost - minCost)) * 100;
  };

  const totalWeight =
    weights.recruitment +
    weights.quality +
    weights.retention +
    weights.diversity +
    weights.cost;

  return rows.map((row) => {
    const components = componentScores(row, costPercentileFor(row));

    // --- weighted composite over available components only ---
    let weightedSum = 0;
    let availableWeight = 0;
    const missing: string[] = [];

    (Object.keys(weights) as (keyof ComponentWeights)[]).forEach((key) => {
      const value = components[key];
      const w = weights[key];
      if (value === null) {
        if (w > 0) missing.push(COMPONENT_LABEL[key]);
        return;
      }
      weightedSum += value * w;
      availableWeight += w;
    });

    const score =
      availableWeight === 0
        ? 0
        : Math.round((weightedSum / availableWeight) * 10) / 10;

    const coverage =
      totalWeight === 0
        ? 0
        : Math.round((availableWeight / totalWeight) * 1000) / 10;

    const present = RAW_KPI_FIELDS.filter(
      (f) => num(row[f] as unknown) !== null,
    ).length;
    const completeness =
      Math.round((present / RAW_KPI_FIELDS.length) * 1000) / 10;

    const confidence: ScoredSite["confidence"] =
      coverage >= 95 && completeness >= 90
        ? "High"
        : coverage >= 80 && completeness >= 70
          ? "Medium"
          : "Low";

    const caveats: string[] = [];
    if (missing.length) {
      caveats.push(
        `No data for ${missing.join(", ")} — scored on the remaining ` +
          `${coverage.toFixed(0)}% of the model weighting.`,
      );
    }
    if (completeness < 100) {
      caveats.push(
        `${RAW_KPI_FIELDS.length - present} of ${RAW_KPI_FIELDS.length} ` +
          `KPI fields are blank on this site's evaluation record.`,
      );
    }
    if (availableWeight === 0) {
      caveats.push("No usable KPI data at all — this site cannot be scored.");
    }

    return {
      siteId: row["Site ID"],
      components,
      score,
      coverage,
      completeness,
      confidence,
      caveats,
    };
  });
}

/**
 * Plain-language explanation of one site's score, for the UI and for the
 * Stage 8 LLM prompt. Mirrors what explainRisk() does for risk: state the
 * arithmetic rather than asserting the number.
 */
export function explainScore(
  scored: ScoredSite,
  weights: ComponentWeights = DECK_WEIGHTS,
): string {
  const lines = (Object.keys(weights) as (keyof ComponentWeights)[])
    .map((key) => {
      const v = scored.components[key];
      const pct = (weights[key] * 100).toFixed(0);
      return v === null
        ? `- ${COMPONENT_LABEL[key]} (${pct}%): no data — excluded, weight redistributed`
        : `- ${COMPONENT_LABEL[key]} (${pct}%): ${v.toFixed(1)}/100`;
    })
    .join("\n");

  return (
    `Site score ${scored.score}/100, from the weighted model:\n${lines}\n` +
    `Confidence: ${scored.confidence} ` +
    `(${scored.coverage.toFixed(0)}% of the model weighting had data behind it, ` +
    `${scored.completeness.toFixed(0)}% of KPI fields populated).`
  );
}
