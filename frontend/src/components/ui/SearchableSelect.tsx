import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectOption } from "./Select";

const LIVE_SEARCH_MIN_CHARS = 2;
const LIVE_SEARCH_DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 40;

export default function SearchableSelect({
  value,
  onChange,
  options,
  onSearch,
  placeholder,
  disabled,
  className,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  onSearch: (query: string) => Promise<string[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [liveResults, setLiveResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const requestIdRef = useRef(0);

  const updateMenuRect = () => {
    const el = controlRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuRect();
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current &&
        !wrapRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleReposition() {
      updateMenuRect();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < LIVE_SEARCH_MIN_CHARS) {
      setLiveResults([]);
      setLoading(false);
      setSearchFailed(false);
      return;
    }
    setLoading(true);
    setSearchFailed(false);
    const myRequestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      onSearch(trimmed)
        .then((results) => {
          if (requestIdRef.current !== myRequestId) return; // stale
          setLiveResults(results);
          setLoading(false);
        })
        .catch(() => {
          if (requestIdRef.current !== myRequestId) return;
          setLiveResults([]);
          setLoading(false);
          setSearchFailed(true);
        });
    }, LIVE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, query, onSearch]);

  const selected = options.find((o) => o.value === value);
  const trimmedQuery = query.trim().toLowerCase();

  const localMatches =
    trimmedQuery.length === 0
      ? options
      : options.filter((o) => {
          const labelMatch = o.label.toLowerCase().includes(trimmedQuery);
          const valueMatch = o.value.toLowerCase().includes(trimmedQuery);
          return labelMatch || valueMatch;
        });

  const seen = new Set(localMatches.map((o) => o.label.toLowerCase()));
  const mergedOptions: SelectOption[] = [
    ...localMatches,
    ...liveResults
      .filter((v) => !seen.has(v.toLowerCase()))
      .map((v) => ({ value: v, label: v })),
  ].slice(0, MAX_VISIBLE_OPTIONS);

  return (
    <div
      className={`ui-select${fullWidth ? " ui-select--full" : ""}${className ? ` ${className}` : ""}${disabled ? " ui-select--disabled" : ""}`}
      ref={wrapRef}
    >
      <div
        ref={controlRef}
        className="ui-select-control ui-select-control--searchable"
        onClick={() => !disabled && !open && setOpen(true)}
      >
        {open ? (
          <input
            ref={inputRef}
            className="ui-select-search-input"
            type="text"
            value={query}
            placeholder={selected?.label || placeholder || "Type to search…"}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <button
            type="button"
            className="ui-select-search-trigger"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className={selected ? "ui-select-value" : "ui-select-placeholder"}>
              {selected ? selected.label : placeholder || ""}
            </span>
          </button>
        )}
        <svg
          className={`ui-select-chevron${open ? " open" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {open &&
        !disabled &&
        menuRect &&
        createPortal(
          <ul
            className={`ui-select-menu ui-select-menu--portaled${className ? ` ${className}` : ""}`}
            role="listbox"
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
            }}
          >
            {loading && (
              <li className="ui-select-status">Searching ClinicalTrials.gov…</li>
            )}
            {!loading && searchFailed && (
              <li className="ui-select-status">
                Live search failed — showing local matches only.
              </li>
            )}
            {!loading && mergedOptions.length === 0 && (
              <li className="ui-select-status">No matching indication found.</li>
            )}
            {mergedOptions.map((opt) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  className={`ui-select-option${opt.value === value ? " selected" : ""}`}
                  onClick={() => {
                    onChange(opt.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span
                    className="ui-select-check"
                    style={{ visibility: opt.value === value ? "visible" : "hidden" }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}