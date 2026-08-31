import { Fragment } from "react";
import { WORKFLOW_STEPS } from "../../constants/workflow";
import { useRoute } from "../../context/RouteContext";
import { usePipeline } from "../../hooks/usePipeline";

export default function WorkflowNav({
  onOpenPredictModal,
}: {
  onOpenPredictModal: () => void;
}) {
  const { route, setRoute, visited } = useRoute();
  const {
    workflowStepAvailable,
    riskAssessment,
    ranking,
    finalResult,
    meta,
    form,
    running,
  } = usePipeline();
  const predictAvailable = !!meta && !!form.indication && !running;

  function isComplete(stepKey: (typeof WORKFLOW_STEPS)[number]["key"]): boolean {
    if (stepKey === "risk") return !!riskAssessment;
    if (stepKey === "ranking") return !!ranking;
    if (stepKey === "recommendation") return !!finalResult;
    return visited.has(stepKey);
  }

  const activeSteps = WORKFLOW_STEPS.filter(
    (step) => step.key !== "site-map-global"
  );

  return (
    <nav className="workflow-nav" aria-label="Guided workflow">
      <ol className="workflow-nav-list">
        <li className="workflow-nav-item-wrap">
          <button
            type="button"
            className="workflow-nav-item workflow-nav-item--predict"
            disabled={!predictAvailable}
            onClick={() => predictAvailable && onOpenPredictModal()}
          >
            <span className="workflow-nav-index">
              {}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
                aria-hidden="true"
              >
                <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span className="workflow-nav-label">Predict Region with AI</span>
          </button>
        </li>
        <li className="workflow-nav-connector" aria-hidden="true" />
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