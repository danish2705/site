import { useEffect } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import type { SavedRunSummary } from "../../types";
import SavedRunModal from "./SavedRunModal";
import ErrorBoundary from "../ui/ErrorBoundary";
import { CloseIcon, EyeIcon, MailIcon, RefreshIcon } from "../ui/Icons";

function shareMailtoHref(r: SavedRunSummary): string {
  const subject = `Trial site recommendation — ${r.label || r.indication}`;
  const lines = [
    `Indication: ${r.indication}`,
    r.phase ? `Phase: ${r.phase}` : null,
    r.region ? `Region: ${r.region}${r.country ? `, ${r.country}` : ""}` : null,
    `Recommended site: ${r.recommended_site_name ?? "—"}`,
    r.score !== null ? `Score: ${r.score}/100` : null,
    r.risk_level ? `Risk level: ${r.risk_level}` : null,
    `Sites ranked: ${r.ranked_site_count}`,
    `Saved: ${new Date(r.created_at).toLocaleString()}`,
  ].filter(Boolean);
  const body = lines.join("\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function HistoryModal({ onClose }: { onClose: () => void }) {
  const {
    savedRuns,
    loadingRuns,
    loadSavedRuns,
    openSavedRun,
    openRun,
    setOpenRun,
    saveMessage,
    canSave,
    openingRunId,
    openRunError,
  } = usePipeline();

  useEffect(() => {
    if (savedRuns === null && !loadingRuns) {
      loadSavedRuns();
    }
  }, []);

  const thStyle: React.CSSProperties = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent-dark)",
    fontWeight: 800,
  };

  return (
    <>
      <div className="run-modal-backdrop" onClick={onClose}>
        <div
          className="run-modal run-modal-wide"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          style={{ width: "min(1500px, 98vw)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <div className="run-modal-head" style={{ flexShrink: 0 }}>
            <div>
              <h2>Saved Runs</h2>
            </div>
            <div className="run-modal-head-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={loadSavedRuns}
                disabled={loadingRuns}
              >
                <RefreshIcon className="btn-icon" />
                {loadingRuns ? "Loading..." : "Refresh"}
              </button>
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
          </div>

          {saveMessage && !canSave && (
            <p className="save-message error" style={{ flexShrink: 0 }}>{saveMessage}</p>
          )}
          {openRunError && (
            <p className="save-message error" style={{ flexShrink: 0 }}>
              Couldn't open that run: {openRunError}
            </p>
          )}

          {!savedRuns && loadingRuns && (
            <div className="stage-loader" style={{ minHeight: "400px" }}>
              <div className="stage-loader-spinner" />
              <div className="stage-loader-text">Loading saved runs...</div>
            </div>
          )}

          {savedRuns && savedRuns.length === 0 && (
            <p className="empty-note" style={{ minHeight: "200px", flexShrink: 0 }}>
              No saved runs yet. Run the pipeline, then use Save run on the
              Recommendation step.
            </p>
          )}

          {savedRuns && savedRuns.length > 0 && (
            <div className="table-scroll saved-runs-scroll" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th style={thStyle}>Saved</th>
                    <th style={thStyle}>Label</th>
                    <th style={thStyle}>Indication</th>
                    <th style={thStyle}>Region</th>
                    <th style={thStyle}>Recommended</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Sites</th>
                    <th style={thStyle}>Action</th>
                    <th style={thStyle}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {savedRuns.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.label ?? <span className="muted">—</span>}</td>
                      <td>{r.indication}</td>
                      <td>
                        {r.region ?? "—"}
                        {r.country ? `, ${r.country}` : ""}
                      </td>
                      <td>{r.recommended_site_name ?? "—"}</td>
                      <td>{r.score !== null ? `${r.score}/100` : "—"}</td>
                      <td>{r.ranked_site_count}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-link row-icon-link icon-only"
                          onClick={() => openSavedRun(r.id)}
                          disabled={openingRunId === r.id}
                          title={openingRunId === r.id ? "Loading..." : "View"}
                          aria-label="View"
                        >
                          {openingRunId === r.id ? (
                            <span className="spinner" />
                          ) : (
                            <EyeIcon className="btn-icon" />
                          )}
                        </button>
                      </td>
                      <td>
                        <a
                          className="btn-link row-icon-link icon-only"
                          href={shareMailtoHref(r)}
                          title="Share this run by email"
                          aria-label="Share by email"
                        >
                          <MailIcon className="btn-icon" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openRun && (
        <ErrorBoundary
          fallback={(error, reset) => (
            <div
              className="run-modal-backdrop"
              onClick={() => {
                reset();
                setOpenRun(null);
              }}
            >
              <div
                className="run-modal run-modal-wide"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{ width: "min(1500px, 98vw)" }}
              >
                <div className="run-modal-head">
                  <div>
                    <h2>Couldn't show this run</h2>
                    <p className="muted">
                      Something went wrong rendering its details.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-close-btn"
                    onClick={() => {
                      reset();
                      setOpenRun(null);
                    }}
                    title="Close"
                    aria-label="Close"
                  >
                    <CloseIcon className="btn-icon" />
                  </button>
                </div>
                <p className="save-message error">{error.message}</p>
              </div>
            </div>
          )}
        >
          <SavedRunModal run={openRun} onClose={() => setOpenRun(null)} />
        </ErrorBoundary>
      )}
    </>
  );
}