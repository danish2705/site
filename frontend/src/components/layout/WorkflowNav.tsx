import { WORKFLOW_STEPS } from "../../constants/workflow";
import { useRoute } from "../../context/RouteContext";
import { usePipeline } from "../../hooks/usePipeline";

export default function WorkflowNav() {
  const { route, setRoute, visited } = useRoute();
  const { workflowStepAvailable, riskAssessment, ranking, finalResult } =
    usePipeline();

  function isComplete(stepKey: (typeof WORKFLOW_STEPS)[number]["key"]): boolean {
    if (stepKey === "risk") return !!riskAssessment;
    if (stepKey === "ranking") return !!ranking;
    if (stepKey === "recommendation") return !!finalResult;
    return visited.has(stepKey);
  }

  // Filter out the global map so it completely disappears from the stepper
  const activeSteps = WORKFLOW_STEPS.filter(
    (step) => step.key !== "site-map-global"
  );

  return (
    <nav className="workflow-nav" aria-label="Guided workflow">
      <ol className="workflow-nav-list">
        {activeSteps.map((step, i) => {
          const available = workflowStepAvailable(step.key);
          const active = route === step.key;
          const complete = isComplete(step.key) && !active;
          return (
            <li className="workflow-nav-item-wrap" key={step.key}>
              <button
                type="button"
                className={`workflow-nav-item ${active ? "active" : ""} ${
                  complete ? "complete" : ""
                }`}
                disabled={!available}
                title={
                  available
                    ? step.label
                    : `${step.label} — not available yet`
                }
                onClick={() => available && setRoute(step.key)}
              >
                <span className="workflow-nav-index">
                  {complete ? "✓" : i + 1}
                </span>
                <span className="workflow-nav-label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}