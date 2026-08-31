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

const LIVE_FIELDS_FOR_COMPONENT: Partial<Record<keyof ComponentScores, string[]>> = {
  recruitment: ["Historical Enrollment Rate (pts/month)", "Competing Trials at Site"],
  retention: ["Dropout Rate (%)"],
  diversity: ["Diversity Index (0-100)"],
};

export default function ScoreBreakdown({
  components,
  liveKpiFields,
  liveKpiSourceNctId,
  raceBreakdown,
}: {
  components: ComponentScores;
  liveKpiFields?: string[];
  liveKpiSourceNctId?: string | null;
  raceBreakdown?: { category: string; percent: number }[] | null;
}) {
  return (
    <div className="score-breakdown">
      {SCORE_COMPONENTS.map(({ key, label, weight }) => {
        const raw = components[key];
        const value = raw === null || raw === undefined ? null : Number(raw);
        const isValid = value !== null && !Number.isNaN(value);
        const liveFields = LIVE_FIELDS_FOR_COMPONENT[key];
        const isPartlyLive = !!liveFields?.some((f) => liveKpiFields?.includes(f));

        const raceBreakdownLine =
          key === "diversity" && raceBreakdown && raceBreakdown.length > 0
            ? raceBreakdown
                .map((r) => `${r.category} ${r.percent.toFixed(0)}%`)
                .join(" · ")
            : null;

        const title = !isValid
          ? `${label} (${weight}%): no data — excluded, weight redistributed`
          : `${label} (${weight}%): ${value.toFixed(1)}/100` +
            (raceBreakdownLine
              ? `\n${raceBreakdownLine}` +
                (liveKpiSourceNctId
                  ? `\n(from ${liveKpiSourceNctId}'s posted results — trial-wide, not this facility alone)`
                  : "")
              : isPartlyLive
                ? " — partly backed by real ClinicalTrials.gov data"
                : "");

        return (
          <div
            key={key}
            className={`score-component${isPartlyLive ? " score-component--live" : ""}`}
            data-tooltip={title}
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
