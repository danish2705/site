import { useEffect, useRef, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";

export default function TopBar({
  onOpenHistory,
}: {
  onOpenHistory: () => void;
}) {
  const { savedRuns } = usePipeline();
  const hasSavedRuns = !!savedRuns && savedRuns.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
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
    <header className="top-bar">
      <div className="top-bar-brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2 2 21h20L12 2zm0 5.2 5.8 11.3H9.4L12 7.2z" />
          </svg>
        </div>
        <span className="brand-name">Trial Site Intel</span>
      </div>

      <div className="top-bar-actions">
        <div className="user-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="user-chip"
            title="Account"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <div className="user-avatar">SM</div>
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
                title="Saved runs"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenHistory();
                }}
              >
                History
                {hasSavedRuns && <span className="icon-btn-dot" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
