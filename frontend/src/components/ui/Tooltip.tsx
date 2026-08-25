import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Themed replacement for the browser's native `title` tooltip, needed
 * specifically for elements that also truncate their own text with
 * `overflow: hidden` (table cells showing "…" for long site/trial names).
 * A plain CSS `::after` tooltip attached to that same element gets clipped
 * by its own `overflow: hidden` — the box clips any content that visually
 * overflows it, pseudo-elements included, regardless of z-index/position
 * (same class of bug as the Leaflet/z-index and portal fixes elsewhere in
 * this app). Portaling the bubble into document.body sidesteps that
 * entirely, same as Select.tsx's dropdown menu.
 *
 * `style`/`className` are applied to the wrapping trigger element itself —
 * pass the truncation styles (overflow/textOverflow/whiteSpace) here
 * instead of on the parent, so the tooltip's own hover target lines up
 * exactly with the truncated text.
 */
export default function Tooltip({
  text,
  children,
  as: Tag = "span",
  className,
  style,
}: {
  text?: string | null;
  children: ReactNode;
  as?: "span" | "div" | "td";
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLElement>(null);

  function show() {
    if (!text) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={className}
      style={style}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        text &&
        pos &&
        createPortal(
          <div
            className="app-tooltip"
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </Tag>
  );
}
