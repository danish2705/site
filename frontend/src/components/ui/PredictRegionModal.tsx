import { useEffect, useRef, useState } from "react";
import type { TrialForm } from "../../types";
import AIRegionPrediction from "../prediction/AIRegionPrediction";
import { CloseIcon } from "./Icons";

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
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
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
          }}
        />
      </div>
    </div>
  );
}
