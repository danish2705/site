import { useEffect, useRef } from "react";
import type { TrialForm } from "../../types";
import AIRegionPrediction from "../prediction/AIRegionPrediction";
import { CloseIcon } from "./Icons";

/**
 * Modal wrapper around the existing, unchanged AIRegionPrediction component
 * — per the UI/UX refinement request, "Predict Region with AI" moved out of
 * the top workflow nav and off its own routed page, into a modal opened by
 * a button next to the Region/Country field in the sidebar. Every input,
 * output, AI response, prediction, and API call inside AIRegionPrediction
 * is untouched; only the presentation (inline page -> centered dialog)
 * changed.
 *
 * Reuses the app's existing modal chrome (.run-modal-backdrop/.run-modal/
 * .icon-close-btn — the same classes SaveRunDialog/HistoryModal/
 * SavedRunModal already use) so this looks consistent with the rest of the
 * app, plus adds an Escape-key listener (not present on the other modals)
 * since this is the first modal in the app that needs one per spec.
 */
export default function PredictRegionModal({
  form,
  disabled,
  onApply,
  onClose,
}: {
  form: TrialForm;
  disabled: boolean;
  onApply: (region: string, country: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Focus the dialog on open so Escape/keyboard interaction works right
    // away without requiring a click inside it first.
    dialogRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="run-modal-backdrop" onClick={onClose}>
      <div
        className="run-modal run-modal-wide predict-region-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Predict Region with AI"
        ref={dialogRef}
        tabIndex={-1}
      >
        <button
          type="button"
          className="icon-close-btn predict-region-modal-close"
          onClick={onClose}
          title="Close"
          aria-label="Close"
        >
          <CloseIcon className="btn-icon" />
        </button>
        <AIRegionPrediction
          form={form}
          disabled={disabled}
          autoPredict
          onApply={(region, country) => {
            onApply(region, country);
            // Stay open after applying — the confirmation ("Applied to
            // form") is shown inline by AIRegionPrediction itself, and the
            // user may want to compare/apply an alternative before closing.
          }}
        />
      </div>
    </div>
  );
}
