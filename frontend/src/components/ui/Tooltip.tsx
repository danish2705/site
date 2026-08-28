import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    flip: boolean;
  } | null>(null);
  const ref = useRef<HTMLElement>(null);
  const FLIP_THRESHOLD = 48;

  function show() {
    if (!text) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const flip = rect.top < FLIP_THRESHOLD;
    setPos({
      top: flip ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      flip,
    });
    setOpen(true);
  }
  function hide() {
    setOpen(false);
  }

  return (
    <Tag
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
              transform: pos.flip
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </Tag>
  );
}
