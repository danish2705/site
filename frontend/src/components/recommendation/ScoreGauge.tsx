/** Same score-band thresholds ScoreBreakdownDetailed uses for its bars, so
    the ring color always agrees with the bars underneath it. */
export function scoreBand(value: number): "good" | "mid" | "bad" {
  if (value >= 80) return "good";
  if (value >= 60) return "mid";
  return "bad";
}

const BAND_COLOR: Record<ReturnType<typeof scoreBand>, string> = {
  good: "var(--success)",
  mid: "var(--warning)",
  bad: "var(--danger)",
};

/**
 * Circular "N out of 100" gauge for the Final Recommendation page's Score
 * Breakdown card. Pure SVG (no chart library) — a background track ring
 * plus a foreground arc whose length encodes the score and whose color
 * follows the same green/amber/red bands as the component bars beside it.
 */
export default function ScoreGauge({ score, size = 128 }: { score: number; size?: number }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color = BAND_COLOR[scoreBand(clamped)];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-gauge">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="score-gauge-value"
      >
        {Math.round(clamped)}
      </text>
      <text
        x="50%"
        y="65%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="score-gauge-label"
      >
        OUT OF 100
      </text>
    </svg>
  );
}
