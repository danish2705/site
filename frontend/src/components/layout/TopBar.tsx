import { usePipeline } from "../../hooks/usePipeline";

// Top bar: brand + app title on the left, a few icon actions and a user
// chip on the right. No page links here on purpose — the app is a single
// dashboard now, not a set of routed pages.
export default function TopBar({
  onOpenHistory,
}: {
  onOpenHistory: () => void;
}) {
  const { savedRuns } = usePipeline();
  const hasSavedRuns = !!savedRuns && savedRuns.length > 0;

  return (
    <header className="top-bar">
      <div className="top-bar-brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 2 21h20L12 2zm0 5.2 5.8 11.3H9.4L12 7.2z" />
          </svg>
        </div>
        <span className="brand-name">Trial Site Intel</span>
      </div>

      <h1 className="top-bar-title">
        AI-Driven Clinical Trial Site Intelligence &amp; Risk Assessment
      </h1>

      <div className="top-bar-actions">
        <button
          type="button"
          className="history-btn"
          title="Saved runs"
          onClick={onOpenHistory}
        >
          History
          {hasSavedRuns && <span className="icon-btn-dot" />}
        </button>
        <div className="user-chip">
          <div className="user-avatar">SM</div>
          <svg
            className="user-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>
    </header>
  );
}
