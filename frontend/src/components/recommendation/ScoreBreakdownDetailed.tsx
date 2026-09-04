import type { ComponentScores } from "../../types";
import ScoreGauge, { scoreBand } from "./ScoreGauge";

const SCORE_COMPONENTS: {
  key: keyof ComponentScores;
  label: string;
  weight: number;
}[] = [
  { key: "recruitment", label: "Recruitment", weight: 35 },
  { key: "quality", label: "Quality", weight: 25 },
  { key: "retention", label: "Retention", weight: 20 },
  { key: "diversity", label: "Diversity", weight: 10 },
  { key: "cost", label: "Cost", weight: 10 },
];

const LIVE_FIELDS_FOR_COMPONENT: Partial<Record<keyof ComponentScores, string[]>> = {
  recruitment: ["Historical Enrollment Rate (pts/month)", "Competing Trials at Site"],
  retention: ["Dropout Rate (%)"],
  diversity: ["Diversity Index (0-100)"],
};

/**
 * Full "Score Breakdown" card for the Final Recommendation page — a
 * circular overall-score gauge alongside every weighted component as a
 * labeled, color-banded bar with its live/estimated status and exact value
 * spelled out (rather than ScoreBreakdown.tsx's compact 4-letter/no-number
 * bars, which stay unchanged for the Ranking table and cards). Also derives
 * "Main strength" / "Main concern" chips from whichever component scored
 * highest/lowest, same green/amber/red bands as the bars.
 */
export default function ScoreBreakdownDetailed({
  score,
  components,
  liveKpiFields,
}: {
  score: number;
  components: ComponentScores;
  liveKpiFields?: string[];
}) {
  const rows = SCORE_COMPONENTS.map(({ key, label, weight }) => {
    const raw = components[key];
    const value = raw === null || raw === undefined ? null : Number(raw);
    const isValid = value !== null && !Number.isNaN(value);
    const liveFields = LIVE_FIELDS_FOR_COMPONENT[key];
    const isLive = !!liveFields?.some((f) => liveKpiFields?.includes(f));
    return { key, label, weight, value: isValid ? value : null, isLive };
  });

  const scored = rows.filter(
    (r): r is typeof r & { value: number } => r.value !== null,
  );
  const strongest = scored.length
    ? scored.reduce((a, b) => (b.value > a.value ? b : a))
    : null;
  const weakest = scored.length
    ? scored.reduce((a, b) => (b.value < a.value ? b : a))
    : null;

  return (
    <div className="score-breakdown-detailed">
      <div className="score-breakdown-detailed-body">
        <ScoreGauge score={score} />

        <div className="score-breakdown-rows">
          {rows.map((r) => (
            <div className="score-breakdown-row" key={r.key}>
              <div className="score-breakdown-row-head">
                <span className="score-breakdown-row-label">{r.label}</span>
                <span className="score-breakdown-row-weight">{r.weight}%</span>
                {r.isLive && <span className="chip live-chip">Live</span>}
              </div>
              <div className="score-breakdown-row-track-wrap">
                <span className="score-breakdown-row-track">
                  {r.value !== null && (
                    <span
                      className={`score-breakdown-row-fill score-breakdown-row-fill--${scoreBand(r.value)}`}
                      style={{ width: `${r.value}%` }}
                    />
                  )}
                </span>
                <span className="score-breakdown-row-value">
                  {r.value !== null ? Math.round(r.value) : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(strongest || weakest) && (
        <div className="score-breakdown-chips">
          {strongest && (
            <span className="chip chip--good">Main strength: {strongest.label}</span>
          )}
          {weakest && (
            <span className="chip chip--warn">Main concern: {weakest.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
