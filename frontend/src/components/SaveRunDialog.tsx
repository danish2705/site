import type { FormEvent } from "react";

// Small dialog opened from the "Save run" text link in the Stage 8 Output
// card header — asks for a label, then saves. Kept separate from
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
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
              Give it a label so you can find it again later.
            </p>
          </div>
          <button type="button" className="btn-link" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="field-block">
          <span className="field-label">Label</span>
          <input
            type="text"
            placeholder="e.g. Q3 HER2+ feasibility"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            disabled={saving}
            autoFocus
          />
        </label>

        {message && <p className="save-message">{message}</p>}

        <div className="save-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save run"}
          </button>
        </div>
      </form>
    </div>
  );
}
