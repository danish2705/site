import { WORKFLOW_STEPS, type WorkflowStep } from "../../constants/workflow";
import { useRoute } from "../../context/RouteContext";
import { usePipeline } from "../../hooks/usePipeline";

function nextStep(current: WorkflowStep): WorkflowStep | null {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === current);
  return WORKFLOW_STEPS[idx + 1]?.key ?? null;
}

function previousStep(current: WorkflowStep): WorkflowStep | null {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === current);
  return idx > 0 ? WORKFLOW_STEPS[idx - 1].key : null;
}

function stepLabel(step: WorkflowStep): string {
  return WORKFLOW_STEPS.find((s) => s.key === step)?.label ?? step;
}

export default function WizardNextLink() {
  const { route, setRoute } = useRoute();
  const { workflowStepAvailable } = usePipeline();
  const prev = previousStep(route);
  const next = nextStep(route);
  const nextAvailable = !!next && workflowStepAvailable(next);
  if (!prev && !nextAvailable) return null;

  return (
    <div className="wizard-next-row">
      {prev && (
        <button
          type="button"
          className="btn-secondary wizard-back-btn"
          onClick={() => setRoute(prev)}
        >
          ← {stepLabel(prev)}
        </button>
      )}
      {nextAvailable && (
        <button
          type="button"
          className="btn-primary wizard-next-btn"
          onClick={() => setRoute(next)}
        >
          {stepLabel(next)} →
        </button>
      )}
    </div>
  );
}
