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

  return (
    <>
      <div className="run-modal-backdrop" onClick={onClose}>
        <div
          className="run-modal run-modal-square"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="run-modal-head run-modal-head--sticky">
            <div>
              <h2>Saved Runs</h2>
              <p className="muted">Every run you've saved, newest first.</p>
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
                className="icon-close-btn icon-close-btn--labeled"
                onClick={onClose}
                aria-label="Close"
              >
                <CloseIcon className="btn-icon" />
              </button>
            </div>
          </div>

          {saveMessage && !canSave && (
            <p className="save-message error">{saveMessage}</p>
          )}
          {openRunError && (
            <p className="save-message error">
              Couldn't open that run: {openRunError}
            </p>
          )}

          {savedRuns && savedRuns.length === 0 && (
            <p className="empty-note">
              No saved runs yet. Run the pipeline, then use Save run on the
              Recommendation step.
            </p>
          )}

          {savedRuns && savedRuns.length > 0 && (
            <div className="table-scroll saved-runs-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Saved</th>
                    <th>Label</th>
                    <th>Indication</th>
                    <th>Region</th>
                    <th>Recommended</th>
                    <th>Score</th>
                    <th>Sites</th>
                    <th>Action</th>
                    <th>Share</th>
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
                          data-tooltip={openingRunId === r.id ? "Loading..." : "View"}
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
                          data-tooltip="Share this run by email"
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
                className="run-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
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
                    data-tooltip="Close"
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
