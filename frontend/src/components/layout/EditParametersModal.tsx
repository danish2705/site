import { useEffect, useRef, type FormEvent } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import ParametersFormFields from "./ParametersFormFields";

/**
 * Reopens the Analysis Parameters form as a modal — triggered by the "Edit
 * Parameters" button in TopBar once a run has already been kicked off (the
 * old always-visible sidebar is gone; this is now the only way back into the
 * form). Reuses the app's existing modal chrome (.run-modal-backdrop/
 * .run-modal — same classes HistoryModal/PredictRegionModal use) plus
 * Escape-key handling. The close (X) button renders inline with
 * ParametersFormFields' own "Edit Parameters" title (via the onClose prop)
 * rather than in a separate bar above it — .sidebar-form-title-row is
 * sticky in this modal (see App.css), so it's still always reachable even
 * once the form's content grows taller than the modal, just without a
 * second, disconnected close bar and the extra top padding that used to
 * reserve room for it.
 */
export default function EditParametersModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { form, runAnalysis } = usePipeline();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleStart(e: FormEvent) {
    e.preventDefault();
    onClose();
    runAnalysis(form);
  }

  return (
    <div className="run-modal-backdrop" onClick={onClose}>
      <div
        className="run-modal edit-parameters-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Parameters"
        ref={dialogRef}
        tabIndex={-1}
      >
        <ParametersFormFields
          onSubmit={handleStart}
          title="Edit Parameters"
          submitLabel="Start Analysis"
          onClose={onClose}
        />
      </div>
    </div>
  );
}
