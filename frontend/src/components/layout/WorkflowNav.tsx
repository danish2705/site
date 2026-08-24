import { Fragment } from "react";
import { WORKFLOW_STEPS } from "../../constants/workflow";
import { useRoute } from "../../context/RouteContext";
import { usePipeline } from "../../hooks/usePipeline";

/**
 * Persistent top-of-page workflow navigation — the guided workflow
 * requested in place of ad-hoc wizard steps + duplicated Site Map tabs.
 * Every numbered item here maps to an existing page — a way to jump
 * straight to any reachable step, see which ones are done, and go back/
 * forward without losing state (the underlying pages/contexts stay mounted
 * for the life of the app — see App.tsx). Rendered as a vertical
 * tick-icon-above-label layout per the requested design (never
 * label-beside-icon).
 *
 * "Predict Region with AI" is prepended ahead of step 1 as a leading,
 * unnumbered action rather than a real WORKFLOW_STEPS entry — it opens a
 * modal (App.tsx's Dashboard still owns that state), not a page, so it
 * doesn't have a route/hash of its own and isn't part of
 * workflowStepAvailable's gating.
 */
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

  return (
    <nav className="workflow-nav" aria-label="Guided workflow">
      <ol className="workflow-nav-list">
        <li className="workflow-nav-item-wrap">
          <button
            type="button"
            className="workflow-nav-item workflow-nav-item--predict"
            disabled={!predictAvailable}
            title={
              !form.indication
                ? "Select an indication first"
                : "Let AI propose a region/country based on the trial requirements"
            }
            onClick={() => predictAvailable && onOpenPredictModal()}
          >
            <span className="workflow-nav-index">✨</span>
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
