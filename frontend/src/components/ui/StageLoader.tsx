/**
 * A page-level loading state — a centered spinner with a caption below it.
 * Used inside a workflow page's own card while that page's backend stage
 * (risk / ranking / final recommendation) is still running, in place of
 * the page rendering blank/nothing until its data arrives.
 */
export default function StageLoader({ label }: { label: string }) {
  return (
    <div className="stage-loader">
      <span className="stage-loader-spinner" aria-hidden="true" />
      <span className="stage-loader-text">{label}</span>
    </div>
  );
}
