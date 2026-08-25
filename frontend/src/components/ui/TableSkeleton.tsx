/**
 * Row-shaped loading placeholder for a data table — shown in place of
 * StageLoader's centered spinner+caption specifically where a table is
 * about to appear (Ranking, Site Map Details, Ongoing Trials). Mimicking
 * the eventual row/column layout means nothing visually "jumps" once the
 * real data lands, unlike a spinner that gets swapped for an unrelated
 * shape.
 */
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
