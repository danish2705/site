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
            // No tooltip here — this item sits right at the top of the
            // page, so the hover bubble (positioned above the trigger) had
            // nowhere to render and showed as a clipped/blank white shape
            // instead of readable text, same issue as the modal's close
            // button.
            onClick={() => predictAvailable && onOpenPredictModal()}
          >
            <span className="workflow-nav-index">
              {/* Radar/scan icon — replaces the sparkle emoji, reads more
                  like "scanning for a region" than a generic AI sparkle. */}
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
                  // No tooltip here — this whole nav bar sits at the very
                  // top of the page, so a hover bubble that opens upward
                  // (the app's standard tooltip direction) has nowhere to
                  // render and just showed up as an empty white box
                  // clipped above the viewport, same issue "Predict Region
                  // with AI" had.
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
