import { usePipeline } from "../../hooks/usePipeline";

export default function RunAnalysisOverlay() {
  const { running, runningStageLabel, cancelRun } = usePipeline();
  if (!running) return null;

  return (
    <div className="run-loading-overlay" role="status" aria-live="polite">
      <div className="run-loading-card">
        <span className="run-loading-spinner" aria-hidden="true" />
        <div className="run-loading-title">Running analysis…</div>
        <div className="run-loading-stage">{runningStageLabel}</div>
        <button
          type="button"
          className="btn-secondary run-loading-cancel"
          onClick={cancelRun}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
