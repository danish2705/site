import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

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
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
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
