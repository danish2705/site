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

export default function ScoreBreakdown({
  components,
}: {
  components: ComponentScores;
}) {
  return (
    <div className="score-breakdown">
      {SCORE_COMPONENTS.map(({ key, label, weight }) => {
        const raw = components[key];
        const value = raw === null || raw === undefined ? null : Number(raw);
        const isValid = value !== null && !Number.isNaN(value);
        return (
          <div
            key={key}
            className="score-component"
            title={
              isValid
                ? `${label} (${weight}%): ${value.toFixed(1)}/100`
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
