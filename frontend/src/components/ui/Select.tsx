import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Themed dropdown replacing the native <select> app-wide. A plain <select>'s
 * OPEN option list is rendered by the OS/browser and can't be restyled with
 * CSS in most browsers — it always shows up with the platform's own blue
 * highlight regardless of the app's own purple theme, which is what this
 * replaces. Renders a button showing the current value plus a custom
 * listbox styled to match the rest of the app (App.css's .ui-select-* rules),
 * with the same closed-state footprint as the old native selects so it drops
 * in without changing layout.
 *
 * The open menu is rendered through a portal into document.body, positioned
 * with `position: fixed` from the trigger button's own bounding rect. This
 * lets it visually overlap content below/around it (like a native <select>'s
 * option list does) instead of being clipped by an ancestor's
 * `overflow: auto/hidden` (e.g. the sidebar form's scroll container) or
 * forcing that ancestor to scroll just to reveal the options.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  title,
  className,
  fullWidth,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown (grayed out) when value is "" and no option matches it — mirrors a disabled placeholder <option value="">. */
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Stretch to fill the parent (matches a native <select> inside a vertical form field). Default is content-sized, like an inline native <select> in a toolbar. */
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const updateMenuRect = () => {
    const el = controlRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuRect();
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
    // capture:true so this also fires for scrolls inside nested scroll
    // containers (e.g. the sidebar form), which don't bubble as "scroll"
    // events on window/document otherwise.
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

  const selected = options.find((o) => o.value === value);

  return (
    <div
      className={`ui-select${fullWidth ? " ui-select--full" : ""}${className ? ` ${className}` : ""}${disabled ? " ui-select--disabled" : ""}`}
      ref={wrapRef}
    >
      <button
        type="button"
        ref={controlRef}
        className="ui-select-control"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        data-tooltip={title}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "ui-select-value" : "ui-select-placeholder"}>
          {selected ? selected.label : placeholder || ""}
        </span>
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
      </button>

      {open &&
        !disabled &&
        menuRect &&
        createPortal(
          <ul
            // The menu portals into document.body, so it's never actually
            // a DOM descendant of the wrapper below — a CSS rule written
            // as ".some-custom-class .ui-select-menu" can never match.
            // Carrying the same custom class onto this element too lets
            // per-instance overrides target it directly instead.
            className={`ui-select-menu ui-select-menu--portaled${className ? ` ${className}` : ""}`}
            role="listbox"
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              // Fixed to the trigger's own width (not minWidth) so the
              // menu never grows past its container's edge (e.g. the
              // sidebar form) — a long option label wraps onto a second
              // line instead (.ui-select-option is white-space: normal).
              width: menuRect.width,
            }}
          >
            {options.map((opt) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  className={`ui-select-option${opt.value === value ? " selected" : ""}`}
                  disabled={opt.disabled}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
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
