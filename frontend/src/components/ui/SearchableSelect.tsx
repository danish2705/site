import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SelectOption } from "./Select";

const LIVE_SEARCH_MIN_CHARS = 2;
const LIVE_SEARCH_DEBOUNCE_MS = 300;
const MAX_VISIBLE_OPTIONS = 40;

/**
 * Search-as-you-type variant of Select, purpose-built for the Indication
 * field. The pre-loaded `options` list (from /api/meta) is capped at the top
 * 250 most common ClinicalTrials.gov conditions — real, but not exhaustive.
 * Typing 2+ characters here additionally queries `onSearch` (live
 * ClinicalTrials.gov condition search — see
 * services/indicationSearch.service.ts) so a less-common real indication
 * that isn't in the pre-loaded 250 can still be found and selected. Local
 * filtering of the pre-loaded list happens instantly on every keystroke;
 * live results are merged in once they arrive, deduped case-insensitively.
 *
 * Selection-only, like Select — there is deliberately no way to submit
 * arbitrary typed text that doesn't match a real, returned option, so the
 * Indication field always holds a genuine ClinicalTrials.gov condition
 * string, not free text.
 */
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
  /** Live search — resolves to real ClinicalTrials.gov condition strings matching `query`. Only called for queries of LIVE_SEARCH_MIN_CHARS+ characters. */
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
  // Guards against a slow, stale live-search response landing after a
  // newer one (or after the query changed again) and clobbering it.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Debounced live search — only for queries long enough to be worth a
  // real ClinicalTrials.gov round-trip.
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
      : options.filter((o) => o.label.toLowerCase().includes(trimmedQuery));

  // Merge local (pre-loaded) matches with live ones, deduped
  // case-insensitively, local first so already-known indications don't
  // reshuffle position once live results land.
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
