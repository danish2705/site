import { WORKFLOW_STEPS } from "../../constants/workflow";
import { useRoute } from "../../context/RouteContext";
import { usePipeline } from "../../hooks/usePipeline";

/**
 * Persistent top-of-page workflow navigation — the guided workflow
 * requested in place of ad-hoc wizard steps + duplicated Site Map tabs.
 * "Predict Region with AI" is deliberately not part of this nav — it's a
 * modal now, opened from the sidebar. Every item here maps to an existing
 * page; nothing here is new business content, just a way to jump straight
 * to any reachable step, see which ones are done, and go back/forward
 * without losing state (the underlying pages/contexts stay mounted for the
 * life of the app — see App.tsx). Rendered as a vertical tick-icon-above-
 * label layout per the requested design (never label-beside-icon).
 */
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

  return (
    <nav className="workflow-nav" aria-label="Guided workflow">
      <ol className="workflow-nav-list">
        {WORKFLOW_STEPS.map((step, i) => {
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
