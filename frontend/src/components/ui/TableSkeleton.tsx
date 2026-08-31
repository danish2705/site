const WIDTH_PATTERN = [92, 62, 78, 45, 84, 58, 70];

export default function TableSkeleton({
  columns = 5,
  rows = 6,
  label,
}: {
  columns?: number;
  rows?: number;
  label?: string;
}) {
  return (
    <div className="table-skeleton" role="status" aria-label={label ?? "Loading table data"}>
      {Array.from({ length: rows }).map((_, r) => (
        <div className="table-skeleton-row" key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <span
              key={c}
              className="table-skeleton-bar"
              style={{ width: `${WIDTH_PATTERN[(r + c) % WIDTH_PATTERN.length]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
