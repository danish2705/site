export default function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="app-toast" role="status">
      <span className="app-toast-icon" aria-hidden="true">
        ⓘ
      </span>
      <span className="app-toast-text">{message}</span>
      <button
        type="button"
        className="app-toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
