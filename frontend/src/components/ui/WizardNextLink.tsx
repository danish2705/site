import { WIZARD_STEPS, type WizardStep } from "../../constants/pipeline";
import { usePipeline } from "../../hooks/usePipeline";

function nextStep(current: WizardStep): WizardStep | null {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === current);
  return WIZARD_STEPS[idx + 1]?.key ?? null;
}

function previousStep(current: WizardStep): WizardStep | null {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === current);
  return idx > 0 ? WIZARD_STEPS[idx - 1].key : null;
}

function stepLabel(step: WizardStep): string {
  return WIZARD_STEPS.find((s) => s.key === step)?.label ?? step;
}

// Rendered inside each wizard-step card's own footer, below its
// .card-scroll-body — so Back/Next live inside the card border rather than
// floating below it. Back always goes to an already-visited step, so it
// doesn't need the wizardStepAvailable gate that Next does.
export default function WizardNextLink() {
  const { wizardStep, setWizardStep, wizardStepAvailable } = usePipeline();
  const prev = previousStep(wizardStep);
  const next = nextStep(wizardStep);
  const nextAvailable = !!next && wizardStepAvailable(next);
  if (!prev && !nextAvailable) return null;

  return (
    <div className="wizard-next-row">
      {prev && (
        <button
          type="button"
          className="btn-secondary wizard-back-btn"
          onClick={() => setWizardStep(prev)}
        >
          ← {stepLabel(prev)}
        </button>
      )}
      {nextAvailable && (
        <button
          type="button"
          className="btn-primary wizard-next-btn"
          onClick={() => setWizardStep(next)}
        >
          {stepLabel(next)} →
        </button>
      )}
    </div>
  );
}
