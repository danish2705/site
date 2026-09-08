import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, XIcon } from "../ui/Icons";
import type { RequirementCheck } from "../../types";

/**
 * Floating "Protocol fit" checklist popover — rendered via a portal into
 * document.body with `position: fixed`, exactly like ui/Tooltip.tsx already
 * does elsewhere in this app.
 */
export default function RequirementChecklistPopover({
  anchorRef,
  open,
  onClose,
  checks,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  checks: RequirementCheck[];
}) {
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    flip: boolean;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const spaceBelow = window.innerHeight - rect.bottom;
    const flip = spaceBelow < 240 && rect.top > 240;
    let left = rect.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    if (left < 12) left = 12;
    setPos({ top: flip ? rect.top - 8 : rect.bottom + 8, left, width, flip });
  }, [open, anchorRef]);

  // Closes on outside click, Escape, or the underlying page scrolling
  // (e.g. a nested scrollable ancestor like .ranking-scroll-body —
  // capture:true catches those even though "scroll" doesn't bubble)
  // rather than trying to keep re-tracking the anchor's position, which is
  // simpler and avoids a stale/misaligned popover.
  //
  // The checklist itself now scrolls internally (.protocol-fit-popover has
  // overflow-y: auto so a long list doesn't run off-screen) — a scroll
  // *inside* the popover also reaches this window-level capture listener
  // (capture fires on the way down through every ancestor, including
  // window, even though the scroll event itself doesn't bubble back up),
  // so without the popoverRef containment check below, scrolling the
  // checklist immediately closed the very popover being scrolled. Only a
  // scroll whose target is outside this popover should dismiss it.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleResize() {
      onClose();
    }
    function handleScroll(e: Event) {
      const target = e.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Protocol fit requirement checklist"
      className="protocol-fit-popover"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        transform: pos.flip ? "translateY(-100%)" : undefined,
      }}
    >
      <table className="requirement-checklist requirement-checklist--popover">
        <thead>
          <tr>
            <th></th>
            <th>Required</th>
            <th>This site</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.criterion}>
              <td>
                <span className={`req-criterion ${c.pass ? "req-pass" : "req-fail"}`}>
                  {c.pass ? <CheckIcon /> : <XIcon />}
                  {c.criterion}
                  {c.actualIsLive && (
                    <span
                      className="live-data-dot"
                      title="This site's own value is real, disclosed data (not an LLM estimate)"
                    />
                  )}
                </span>
              </td>
              <td>{c.required}</td>
              <td>{c.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
