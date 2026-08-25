import { usePipeline } from "../../hooks/usePipeline";

/**
 * Full-screen loading overlay shown for the duration of "Run Analysis"
 * (Stages 1-8 streaming in the background) — replaces the old behavior of
 * auto-navigating to Site Map (Global) and letting the user watch that
 * page's own "Search" state while the pipeline ran unrelated stages behind
 * it. Rendered as a sibling at the top of the app shell (see App.tsx) so it
 * covers the whole screen, including the sidebar and workflow nav.
 */
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
