import type { EvaluationRow } from "../types.js";

export interface ComponentWeights {
  recruitment: number;
  quality: number;
  retention: number;
  diversity: number;
  cost: number;
}

export const DECK_WEIGHTS: ComponentWeights = {
  recruitment: 0.35,
  quality: 0.25,
  retention: 0.2,
  diversity: 0.1,
  cost: 0.1,
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function higherBetter(v: number | null, best: number): number | null {
  return v === null ? null : clamp100((v / best) * 100);
}

function lowerBetter(
  v: number | null,
  floor: number,
  ceiling: number,
): number | null {
  if (v === null) return null;
  if (ceiling <= floor) return 100;
  return clamp100(((ceiling - v) / (ceiling - floor)) * 100);
}

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
  score: number;
  coverage: number;
  completeness: number;
  confidence: "High" | "Medium" | "Low";
  caveats: string[];
}

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
  /** "llm-estimated" = KPIs guessed by an LLM for a real live-sourced site with no measured data; absent/"excel" = measured, from Site_Evaluation. */
  dataSource?: "excel" | "llm-estimated";
  /** Set only when dataSource === "llm-estimated" — the model's own explanation of what it grounded the estimate in. */
  estimateRationale?: string;
  /**
   * Names of the raw KPI fields on THIS row that were overridden with real
   * ClinicalTrials.gov data instead of the LLM estimate — e.g.
   * "Historical Enrollment Rate (pts/month)", "Dropout Rate (%)",
   * "Diversity Index (0-100)". Undefined/empty means every field on this row
   * is still LLM-estimated (or, for dataSource "excel", measured). See
   * liveCandidateSites.ts's applyLiveKpiOverrides for what's real and why;
   * Dropout Rate / Diversity Index are trial-level, not site-level, figures
   * (ClinicalTrials.gov has no per-site breakout for either) — see
   * liveKpiSourceNctId for which trial they came from.
   */
  liveKpiFields?: string[];
  /** The NCTId that Dropout Rate (%) / Diversity Index (0-100) were sourced from, when either is in liveKpiFields. null/absent otherwise. */
  liveKpiSourceNctId?: string | null;
}

/**
 * LLM-estimated KPIs are, by construction, never as certain as a measured
 * Site_Evaluation row — even with every field populated. This caps a
 * ScoredSite's confidence at "Medium" for such rows and adds a caveat
 * explaining why, rather than letting the ordinary coverage/completeness
 * math claim "High" confidence for a guess.
 */
export function capConfidenceForEstimate(
  scored: ScoredSite,
  row: ExtendedEvaluationRow,
): ScoredSite {
  if (row.dataSource !== "llm-estimated") return scored;
  const caveats = [...scored.caveats];
  if (scored.confidence === "High") {
    caveats.push(
      "KPI data for this site is LLM-estimated, not measured — confidence capped at Medium regardless of field coverage.",
    );
    return { ...scored, confidence: "Medium", caveats };
  }
  caveats.push("KPI data for this site is LLM-estimated, not measured.");
  return { ...scored, caveats };
}

export const THRESHOLDS = {
  enrollmentRateBest: 25, 
  screenFailure: { floor: 10, ceiling: 70 }, 
  timeToFpi: { floor: 14, ceiling: 200 }, 
  startUp: { floor: 21, ceiling: 220 }, 
  queryRate: { floor: 2, ceiling: 55 }, 
  queryResolution: { floor: 1, ceiling: 40 }, 
  dataEntryLag: { floor: 0.5, ceiling: 35 }, 
  protocolDeviation: { floor: 0.3, ceiling: 20 }, 
  dropout: { floor: 2, ceiling: 30 }, 
  staffTurnover: { floor: 2, ceiling: 50 }, 
};

function componentScores(
  row: ExtendedEvaluationRow,
  costPercentile: number | null,
): ComponentScores {
  const T = THRESHOLDS;

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

  const diversityRaw = num(row["Diversity Index (0-100)"]);
  const diversity = diversityRaw === null ? null : clamp100(diversityRaw);

  const cost = costPercentile === null ? null : clamp100(costPercentile);

  return { recruitment, quality, retention, diversity, cost };
}

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

export function scoreSites(
  rows: ExtendedEvaluationRow[],
  weights: ComponentWeights = DECK_WEIGHTS,
): ScoredSite[] {
  const costs = rows
    .map((r) => num(r["Site Cost per Patient (USD)"]))
    .filter((n): n is number => n !== null);
  const minCost = costs.length ? Math.min(...costs) : null;
  const maxCost = costs.length ? Math.max(...costs) : null;

  const costPercentileFor = (r: ExtendedEvaluationRow): number | null => {
    const c = num(r["Site Cost per Patient (USD)"]);
    if (c === null || minCost === null || maxCost === null) return null;
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
    if (row.liveKpiFields && row.liveKpiFields.length > 0) {
      caveats.push(
        `Real ClinicalTrials.gov data used for: ${row.liveKpiFields.join(", ")}` +
          (row.liveKpiSourceNctId
            ? ` (Dropout Rate/Diversity Index, if listed, are from ${row.liveKpiSourceNctId}'s posted results — trial-wide, not this specific site).`
            : "."),
      );
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
