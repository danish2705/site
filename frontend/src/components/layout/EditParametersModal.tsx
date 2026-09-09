import { useEffect, useRef, type FormEvent } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import ParametersFormFields from "./ParametersFormFields";

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
