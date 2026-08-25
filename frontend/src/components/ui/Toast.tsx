/**
 * Dismissible, non-blocking notification — for informational messages
 * (e.g. a data source silently falling back) that must be visible but
 * shouldn't read like an error. Distinct in style from .shell-error/
 * .error-text (red) so a real problem and a "just so you know" never
 * look the same.
 */
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
