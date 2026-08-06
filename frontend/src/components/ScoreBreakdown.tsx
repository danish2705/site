import type { ComponentScores } from "../types";

// Compact per-component bar for a site's weighted score. A component with
// no data renders as a gap with a "no data" title rather than a zero-width
// bar, since those mean very different things: the backend drops an
// unmeasured component and renormalises the remaining weights.
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
        const value = components[key];
        return (
          <div
            key={key}
            className="score-component"
            title={
              value === null
                ? `${label} (${weight}%): no data — excluded, weight redistributed`
                : `${label} (${weight}%): ${value.toFixed(1)}/100`
            }
          >
            <span className="score-component-label">{label.slice(0, 4)}</span>
            <span className="score-component-track">
              {value !== null && (
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
