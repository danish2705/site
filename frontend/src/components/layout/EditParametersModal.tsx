import { useEffect, useRef, type FormEvent } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import { CloseIcon } from "../ui/Icons";
import ParametersFormFields from "./ParametersFormFields";

/**
 * Reopens the Analysis Parameters form as a modal — triggered by the "Edit
 * Parameters" button in TopBar once a run has already been kicked off (the
 * old always-visible sidebar is gone; this is now the only way back into the
 * form). Reuses the app's existing modal chrome (.run-modal-backdrop/
 * .run-modal/.icon-close-btn — same classes HistoryModal/PredictRegionModal
 * use) plus PredictRegionModal's sticky top-right close-bar pattern and
 * Escape-key handling, so a cross/X button is always reachable even once the
 * form's own content grows taller than the modal.
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
        <div className="predict-region-modal-close-bar">
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon className="btn-icon" />
          </button>
        </div>
        <ParametersFormFields
          onSubmit={handleStart}
          title="Edit Parameters"
          submitLabel="Start Analysis"
        />
      </div>
    </div>
  );
}
