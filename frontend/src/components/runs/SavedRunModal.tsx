import type { SavedRunDetail } from "../../types";
import ScoreBreakdown from "../ranking/ScoreBreakdown";
import { CloseIcon } from "../ui/Icons";

// Detail modal for a saved run. Backdrop closes on click; the panel stops
// propagation so a click inside doesn't dismiss it.
export default function SavedRunModal({
  run,
  onClose,
}: {
  run: SavedRunDetail;
  onClose: () => void;
}) {
  return (
    <div className="run-modal-backdrop" onClick={onClose}>
      <div
        className="run-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="run-modal-head">
          <div>
            <h2>{run.run.label ?? run.run.indication}</h2>
            <p className="muted">
              {run.run.indication} · {run.run.phase ?? "n/a"} · n=
              {run.run.sample_size ?? "n/a"} ·{" "}
              {new Date(run.run.created_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon className="btn-icon" />
          </button>
        </div>

        {run.run.recommendation_text && (
          <p className="final-text">{run.run.recommendation_text}</p>
        )}

        {(!run.sites || run.sites.length === 0) && (
          <p className="empty-note">
            This run was saved with no ranked sites recorded — there's nothing
            else to show for it.
          </p>
        )}

        {run.sites && run.sites.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Site</th>
                  <th>Score</th>
                  <th>Breakdown</th>
                  <th>Protocol fit</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {run.sites.map((s) => (
                  <tr key={s.rank}>
                    <td>{s.rank}</td>
                    <td>
                      {s.site_name}
                      <div className="site-id">{s.site_id}</div>
                    </td>
                    <td>
                      {s.score !== null ? `${s.score}/100` : "—"}
                      {s.confidence && s.confidence !== "High" && (
                        <div className="score-confidence">
                          {s.confidence.toLowerCase()} confidence
                        </div>
                      )}
                    </td>
                    <td>
                      {/* Rebuilt from the flat DB columns. Nulls stay null
                          so an unmeasured component still renders as a gap,
                          not a zero bar. */}
                      <ScoreBreakdown
                        components={{
                          recruitment: s.recruitment_score,
                          quality: s.quality_score,
                          retention: s.retention_score,
                          diversity: s.diversity_score,
                          cost: s.cost_score,
                        }}
                      />
                    </td>
                    <td>
                      {s.meets_requirements ? (
                        <span className="badge low">Meets all</span>
                      ) : (
                        <span
                          className="badge medium"
                          title={`Fails: ${(s.failed_criteria ?? []).join(", ")}`}
                        >
                          {(s.failed_criteria ?? []).length} unmet
                        </span>
                      )}
                    </td>
                    <td>
                      {s.risk_level && (
                        <span className={`badge ${s.risk_level.toLowerCase()}`}>
                          {s.risk_level}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
