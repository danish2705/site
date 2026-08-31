import type { ReactNode } from "react";
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
