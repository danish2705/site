import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipTag = "span" | "div" | "td" | "th" | "button" | "a" | "label";

export default function Tooltip({
  text,
  children,
  as: Tag = "span",
  className,
  style,
  elementRef,
  ...rest
}: {
  text?: string | null;
  children?: ReactNode;
  as?: TooltipTag;
  className?: string;
  style?: CSSProperties;
  /** Optional external ref to the rendered element — for the rare caller
      that also needs direct DOM access to this same node for something
      else (e.g. positioning an unrelated floating panel off of it) in
      addition to this component's own tooltip positioning. */
  elementRef?:
    | { current: HTMLElement | null }
    | ((node: HTMLElement | null) => void);
  // Any other native attribute/handler (onClick, disabled, href, type,
  // aria-*, etc.) — forwarded as-is so this component can be dropped in
  // place of the original tag without losing its existing behavior.
  [key: string]: any;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    flip: boolean;
  } | null>(null);
  const ref = useRef<HTMLElement>(null);
  const FLIP_THRESHOLD = 48;

  function setRefs(node: HTMLElement | null) {
    ref.current = node;
    if (typeof elementRef === "function") {
      elementRef(node);
    } else if (elementRef) {
      elementRef.current = node;
    }
  }

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
      ref={setRefs as any}
      className={className}
      style={style}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...rest}
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
