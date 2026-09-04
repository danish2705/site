import { useEffect, useRef, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import DataTransparencyModal from "../ui/DataTransparencyModal";
import { EditIcon, UserIcon } from "../ui/Icons";

export default function TopBar({
  onOpenHistory,
  onEditParameters,
  showEditParameters = true,
  onGoToLanding,
}: {
  onOpenHistory: () => void;
  /** Opens EditParametersModal — the only way back into the Analysis
      Parameters form now that it's no longer a permanent sidebar. Disabled
      while a run is in flight since editing params mid-run has nothing to
      apply to until the next run. */
  onEditParameters: () => void;
  /** Hide the "Edit Parameters" button — used on ParametersFormPage itself,
      where the user is already editing parameters and there's nothing yet
      to jump back to. */
  showEditParameters?: boolean;
  /** Clicking the "Clinical Trial Site Selection" brand/logo returns to the
      landing/start screen. Optional so TopBar can still render (brand as
      plain, non-interactive text) anywhere this handler isn't wired up. */
  onGoToLanding?: () => void;
}) {
  const { savedRuns, running, nctScope } = usePipeline();
  const hasSavedRuns = !!savedRuns && savedRuns.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dataTransparencyOpen, setDataTransparencyOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <>
      <header className="top-bar">
      {onGoToLanding ? (
        <button
          type="button"
          className="top-bar-brand top-bar-brand--link"
          onClick={onGoToLanding}
          data-tooltip="Back to the start screen"
        >
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 2 21h20L12 2zm0 5.2 5.8 11.3H9.4L12 7.2z" />
            </svg>
          </div>
          <span className="brand-name">Clinical Trial Site Selection</span>
        </button>
      ) : (
        <div className="top-bar-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 2 21h20L12 2zm0 5.2 5.8 11.3H9.4L12 7.2z" />
            </svg>
          </div>
          <span className="brand-name">Clinical Trial Site Selection</span>
        </div>
      )}

      <div className="top-bar-actions">
        {showEditParameters && (
          <button
            type="button"
            className="history-btn edit-parameters-btn"
            onClick={onEditParameters}
            disabled={running || !!nctScope}
          >
            <EditIcon className="btn-icon" />
            Edit Parameters
          </button>
        )}
        <div className="user-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="user-chip"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <div className="user-avatar">
              <UserIcon className="btn-icon" />
            </div>
            {hasSavedRuns && <span className="icon-btn-dot" />}
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
          </button>
          {menuOpen && (
            <div className="user-menu-dropdown">
              <button
                type="button"
                className="user-menu-item"
                data-tooltip="Saved runs"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenHistory();
                }}
              >
                History
                {hasSavedRuns && <span className="icon-btn-dot" />}
              </button>
              <button
                type="button"
                className="user-menu-item"
                data-tooltip="What's live vs. synthetic data in this run"
                onClick={() => {
                  setMenuOpen(false);
                  setDataTransparencyOpen(true);
                }}
              >
                Data Transparency
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

      {dataTransparencyOpen && (
        <DataTransparencyModal onClose={() => setDataTransparencyOpen(false)} />
      )}
    </>
  );
}