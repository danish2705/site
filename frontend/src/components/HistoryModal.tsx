import { useEffect } from "react";
import { usePipeline } from "../context/PipelineContext";
import SavedRunModal from "./SavedRunModal";

// Saved runs live behind the clock icon in the top bar rather than a nav
// page — this modal shows the list, and drills into SavedRunModal for one
// run's full detail.
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
  } = usePipeline();

  // Loads the list lazily, the first time this modal opens, rather than on
  // every app load.
  useEffect(() => {
    if (savedRuns === null && !loadingRuns) {
      loadSavedRuns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="run-modal-backdrop" onClick={onClose}>
        <div
          className="run-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="run-modal-head">
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
                {loadingRuns ? "Loading..." : "Refresh"}
              </button>
              <button type="button" className="btn-link" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          {saveMessage && !canSave && (
            <p className="save-message">{saveMessage}</p>
          )}

          {savedRuns && savedRuns.length === 0 && (
            <p className="empty-note">
              No saved runs yet. Run the pipeline, then use Save run on the
              Recommendation step.
            </p>
          )}

          {savedRuns && savedRuns.length > 0 && (
            <div className="table-scroll">
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
                    <th />
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
                          className="btn-link"
                          onClick={() => openSavedRun(r.id)}
                        >
                          View
                        </button>
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
        <SavedRunModal run={openRun} onClose={() => setOpenRun(null)} />
      )}
    </>
  );
}
