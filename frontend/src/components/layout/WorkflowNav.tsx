import { Fragment } from "react";
import { WORKFLOW_STEPS } from "../../constants/workflow";
import { useRoute } from "../../context/RouteContext";
import { usePipeline } from "../../hooks/usePipeline";

export default function WorkflowNav() {
  const { route, setRoute, visited } = useRoute();
  const {
    workflowStepAvailable,
    riskAssessment,
    ranking,
    finalResult,
  } = usePipeline();

  function isComplete(stepKey: (typeof WORKFLOW_STEPS)[number]["key"]): boolean {
    if (stepKey === "risk") return !!riskAssessment;
    if (stepKey === "ranking") return !!ranking;
    if (stepKey === "recommendation") return !!finalResult;
    return visited.has(stepKey);
  }

  return (
    <nav className="workflow-nav" aria-label="Guided workflow">
      <ol className="workflow-nav-list">
        {WORKFLOW_STEPS.map((step, i) => {
          const available = workflowStepAvailable(step.key);
          const active = route === step.key;
          const complete = isComplete(step.key) && !active;
          return (
            <Fragment key={step.key}>
              <li className="workflow-nav-item-wrap">
                <button
                  type="button"
                  className={`workflow-nav-item ${active ? "active" : ""} ${
                    complete ? "complete" : ""
                  }`}
                  disabled={!available}
                  onClick={() => available && setRoute(step.key)}
                >
                  <span className="workflow-nav-index">
                    {complete ? "✓" : i + 1}
                  </span>
                  <span className="workflow-nav-label">{step.label}</span>
                </button>
              </li>
              {i < WORKFLOW_STEPS.length - 1 && (
                <li className="workflow-nav-connector" aria-hidden="true" />
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
