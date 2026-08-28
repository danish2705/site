export default function StageLoader({ label }: { label: string }) {
  return (
    <div className="stage-loader">
      <span className="stage-loader-spinner" aria-hidden="true" />
      <span className="stage-loader-text">{label}</span>
    </div>
  );
}
