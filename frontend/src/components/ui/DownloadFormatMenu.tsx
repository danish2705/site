import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export type DownloadFormat = "pdf" | "excel";

export default function DownloadFormatMenu({
  anchorRef,
  open,
  onClose,
  onSelect,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  onSelect: (format: DownloadFormat) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flip = spaceBelow < 140 && rect.top > 140;
    let left = rect.right - width;
    if (left < 12) left = 12;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    setPos({ top: flip ? rect.top - 8 : rect.bottom + 8, left, flip });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleDismiss() {
      onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Choose a download format"
      className="download-format-menu"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 200,
        transform: pos.flip ? "translateY(-100%)" : undefined,
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="download-format-menu-item"
        onClick={() => onSelect("pdf")}
      >
        <span className="download-format-menu-item-title">PDF</span>
        <span className="download-format-menu-item-sub">Printable report</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="download-format-menu-item"
        onClick={() => onSelect("excel")}
      >
        <span className="download-format-menu-item-title">Excel</span>
        <span className="download-format-menu-item-sub">CSV — opens in Excel</span>
      </button>
    </div>,
    document.body,
  );
}
