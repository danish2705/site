import { useState, useRef, useEffect } from "react";
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

  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

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
        <div ref={menuRef} style={{ position: "relative" }}>
          <div
            className="user-chip"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ cursor: "pointer", position: "relative" }}
            role="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
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
            {hasSavedRuns && (
              <span
                className="icon-btn-dot"
                style={{ top: "-2px", right: "-2px" }}
              />
            )}
          </div>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "8px",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                boxShadow: "var(--shadow)",
                padding: "8px",
                minWidth: "200px",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onOpenHistory();
                  setMenuOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  border: "none",
                  background: "transparent",
                  color: "var(--ink)",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                History
                {hasSavedRuns && (
                  <span
                    className="icon-btn-dot"
                    style={{ position: "relative", top: "auto", right: "auto" }}
                  />
                )}
              </button>

              <div
                onClick={toggleTheme}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  color: "var(--ink)",
                  fontSize: "13.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
                {/* Visual iOS/Tailwind-style Toggle Switch */}
                <div
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "20px",
                    backgroundColor: isDark ? "var(--accent)" : "var(--line)",
                    position: "relative",
                    transition: "background-color 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      backgroundColor: "#ffffff",
                      position: "absolute",
                      top: "2px",
                      left: isDark ? "18px" : "2px",
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}