import type { ComponentScores } from "../../types";

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

const LIVE_FIELD_FOR_COMPONENT: Partial<Record<keyof ComponentScores, string>> = {
  recruitment: "Historical Enrollment Rate (pts/month)",
  retention: "Dropout Rate (%)",
  diversity: "Diversity Index (0-100)",
};

export default function ScoreBreakdown({
  components,
  liveKpiFields,
}: {
  components: ComponentScores;
  /** Raw KPI field names on this site's row that are real ClinicalTrials.gov data rather than an LLM estimate. */
  liveKpiFields?: string[];
}) {
  return (
    <div className="score-breakdown">
      {SCORE_COMPONENTS.map(({ key, label, weight }) => {
        const raw = components[key];
        const value = raw === null || raw === undefined ? null : Number(raw);
        const isValid = value !== null && !Number.isNaN(value);
        const liveField = LIVE_FIELD_FOR_COMPONENT[key];
        const isPartlyLive = !!liveField && !!liveKpiFields?.includes(liveField);
        return (
          <div
            key={key}
            className={`score-component${isPartlyLive ? " score-component--live" : ""}`}
            title={
              isValid
                ? `${label} (${weight}%): ${value.toFixed(1)}/100` +
                  (isPartlyLive
                    ? " — partly backed by real ClinicalTrials.gov data"
                    : "")
                : `${label} (${weight}%): no data — excluded, weight redistributed`
            }
          >
            <span className="score-component-label">{label.slice(0, 4)}</span>
            <span className="score-component-track">
              {isValid && (
                <span
                  className="score-component-fill"
                  style={{ width: `${value}%` }}
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
