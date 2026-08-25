import { useEffect, useRef, useState } from "react";
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
  // Starts compact (title + button, nothing else yet) and widens once a
  // prediction actually comes back with content worth the extra room —
  // see AIRegionPrediction's onResultChange.
  const [hasResult, setHasResult] = useState(false);

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
        className={`run-modal predict-region-modal${hasResult ? " predict-region-modal--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Predict Region with AI"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="predict-region-modal-close-bar">
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            // No tooltip here — this button sits right at the top edge of
            // the modal (inside the sticky close-bar), so the hover bubble
            // (positioned above the trigger) had nowhere to render and
            // showed as a clipped/blank white shape instead of readable
            // text. The X icon is unambiguous on its own.
            aria-label="Close"
          >
            <CloseIcon className="btn-icon" />
          </button>
        </div>
        <AIRegionPrediction
          form={form}
          disabled={disabled}
          autoPredict
          onResultChange={setHasResult}
          onCancelClose={onClose}
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
