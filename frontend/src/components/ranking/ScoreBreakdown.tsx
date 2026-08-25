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

// A component can now be backed by more than one real (non-LLM-estimated)
// field — e.g. Recruitment is real if EITHER Historical Enrollment Rate OR
// the real facility-workload count (Competing Trials at Site — see
// pipeline/liveCandidateSites.ts's applyLiveKpiOverrides) was used, so the
// "live" highlight below reflects either real signal, not just the first
// one this file happened to know about.
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
  /** Raw KPI field names on this site's row that are real ClinicalTrials.gov data rather than an LLM estimate. */
  liveKpiFields?: string[];
  /** The NCTId Dropout Rate/Diversity Index (if real) were sourced from — trial-wide, not this site alone. */
  liveKpiSourceNctId?: string | null;
  /** Real race/ethnicity category breakdown behind the Diversity component, when real. null/undefined when it's LLM-estimated instead. */
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

        // Diversity-specific: when it's real, build a quick "White 61% ·
        // Black 19% · ..." line from the actual reported category
        // breakdown instead of just the collapsed 0-100 index — this is
        // the tooltip-list option (no extra click), so it has to stay
        // short; showing every category is fine since there are usually
        // only 4-6 of them.
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
