import { useState } from "react";
import type { RiskExplanation } from "../types";

// Explains WHY the recommended site holds its Low/Medium/High rating.
// Stage 8 only: the Stage 6 accordion shows each site's raw risk register,
// where the Likelihood / Impact / Overall columns already speak for
// themselves, so repeating the derivation above that table is just noise.
export default function WhyThisRating({
  explanation,
  onDark = false,
}: {
  explanation: RiskExplanation;
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const e = explanation;

  return (
    <div className={`why-risk ${onDark ? "on-dark" : ""}`}>
      <div className="why-risk-head">
        <span className={`badge ${e.level.toLowerCase()}`}>{e.level} Risk</span>
        <span className="why-risk-rule">{e.rule}</span>
      </div>

      <div className="why-risk-mix">
        <span className="why-risk-stat">
          <strong>{e.totalRecords}</strong> record(s)
        </span>
        <span className="why-risk-stat high">
          <strong>{e.highCount}</strong> High
        </span>
        <span className="why-risk-stat medium">
          <strong>{e.mediumCount}</strong> Medium
        </span>
        <span className="why-risk-stat low">
          <strong>{e.lowCount}</strong> Low
        </span>
        {e.totalRecords > 0 && (
          <span className="why-risk-stat">
            <strong>{e.activeAtLevel}</strong> of {e.driverTotal} deciding
            record(s) still open
          </span>
        )}
      </div>

      {e.drivers.length > 0 && (
        <>
          <button
            type="button"
            className="link-btn"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? "Hide" : "Show"} the {e.level.toLowerCase()} record(s)
            behind this rating
            {e.driverTotal > e.drivers.length &&
              ` (top ${e.drivers.length} of ${e.driverTotal})`}
          </button>
          {open && (
            <ul className="driver-list">
              {e.drivers.map((d) => (
                <li className="driver-item" key={d.riskId}>
                  <div className="driver-top">
                    <span className="driver-id">{d.riskId}</span>
                    <span className="driver-cat">{d.category}</span>
                    <span
                      className={`driver-status ${d.active ? "active" : ""}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="driver-desc">{d.description}</div>
                  {/* The actual derivation: this is what turns "High" from
                      an assertion into something the reader can check. */}
                  <div className="driver-derivation">{d.derivation}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {e.categoryCounts.length > 0 && e.level !== "Low" && (
        <div className="why-risk-cats">
          {e.categoryCounts
            .filter((c) => c.high > 0 || c.medium > 0)
            .map((c) => (
              <span className="chip" key={c.category}>
                {c.category}: {c.high > 0 && `${c.high} high`}
                {c.high > 0 && c.medium > 0 && ", "}
                {c.medium > 0 && `${c.medium} medium`}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
