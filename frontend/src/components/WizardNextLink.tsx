import {
  usePipeline,
  WIZARD_STEPS,
  type WizardStep,
} from "../context/PipelineContext";

function nextStep(current: WizardStep): WizardStep | null {
  const idx = WIZARD_STEPS.findIndex((s) => s.key === current);
  return WIZARD_STEPS[idx + 1]?.key ?? null;
}

function stepLabel(step: WizardStep): string {
  return WIZARD_STEPS.find((s) => s.key === step)?.label ?? step;
}

// Rendered inside each wizard-step card's own footer, below its
// .card-scroll-body — so "Next" lives inside the card border rather than
// floating below it — and styled as a plain text link instead of a
// filled button.
export default function WizardNextLink() {
  const { wizardStep, setWizardStep, wizardStepAvailable } = usePipeline();
  const next = nextStep(wizardStep);
  if (!next || !wizardStepAvailable(next)) return null;

  return (
    <div className="wizard-next-row">
      <button
        type="button"
        className="btn-link wizard-next-link"
        onClick={() => setWizardStep(next)}
      >
        Next: {stepLabel(next)} →
      </button>
    </div>
  );
}
