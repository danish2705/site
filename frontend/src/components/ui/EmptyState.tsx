import type { ReactNode } from "react";

/**
 * Icon + title (+ optional detail line) for an empty/placeholder state —
 * replaces a bare line of muted text so "nothing here yet" reads as an
 * intentional state rather than missing content. Renders inside the
 * existing `.predict-placeholder` dashed-border box, which still owns the
 * box's sizing/border; this only styles what's inside it.
 */
export default function EmptyState({
  icon = "✦",
  title,
  detail,
}: {
  icon?: ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="empty-state-title">{title}</div>
      {detail && <div className="empty-state-detail">{detail}</div>}
    </div>
  );
}
