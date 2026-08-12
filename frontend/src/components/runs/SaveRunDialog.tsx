import { useState, type FormEvent } from "react";
import { CloseIcon } from "../ui/Icons";

// Small dialog opened from the "Save" button in the Stage 8 Output card
// header — asks for a label, then saves. Kept separate from
// SavedRunModal.tsx, which is the read-only detail view for a run that's
// already been saved.
export default function SaveRunDialog({
  label,
  onLabelChange,
  saving,
  message,
  onSave,
  onClose,
}: {
  label: string;
  onLabelChange: (label: string) => void;
  saving: boolean;
  message: string | null;
  onSave: () => Promise<boolean>;
  onClose: () => void;
}) {
  // A run must be saved with a name so it's findable again in Saved Runs —
  // caught here (before the request even fires) rather than letting the
  // backend silently accept a blank label.
  const [validationError, setValidationError] = useState<string | null>(null);
  const trimmed = label.trim();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmed) {
      setValidationError("Please enter a name for this run before saving.");
      return;
    }
    setValidationError(null);
    const ok = await onSave();
    if (ok) onClose();
  }

  return (
    <div className="run-modal-backdrop" onClick={onClose}>
      <form
        className="run-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
      >
        <div className="run-modal-head">
          <div>
            <h2>Save this run</h2>
            <p className="muted">
              Give it a name so you can find it again later.
            </p>
          </div>
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <CloseIcon className="btn-icon" />
          </button>
        </div>

        <label className="field-block">
          <span className="field-label">Name</span>
          <input
            type="text"
            placeholder="e.g. Q3 HER2+ feasibility"
            value={label}
            onChange={(e) => {
              onLabelChange(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={saving}
            required
            autoFocus
          />
        </label>

        {validationError && <p className="save-message">{validationError}</p>}
        {!validationError && message && (
          <p className="save-message">{message}</p>
        )}

        <div className="save-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !trimmed}
          >
            {saving ? "Saving..." : "Save run"}
          </button>
        </div>
      </form>
    </div>
  );
}
