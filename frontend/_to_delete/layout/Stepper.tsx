import { STAGE_LIST, type WizardStep } from "../../constants/pipeline";
import type { StagesMap } from "../../types";

const STAGE_TO_WIZARD: Partial<Record<number, WizardStep>> = {
  6: "risk",
  7: "ranking",
  8: "recommendation",
};

export default function Stepper({
  stages,
  activeWizardStep,
  onSelectWizardStep,
}: {
  stages: StagesMap;
  activeWizardStep?: WizardStep;
  onSelectWizardStep?: (step: WizardStep) => void;
}) {
  return (
    <div className="stepper">
      <div className="stepper-nodes">
        {STAGE_LIST.map((s, i) => {
          const st = stages[s.n];
          const wizardKey = STAGE_TO_WIZARD[s.n];
          const clickable =
            !!wizardKey && st.status === "complete" && !!onSelectWizardStep;
          const isActive = !!wizardKey && wizardKey === activeWizardStep;
          return (
            <div className="stepper-node-wrap" key={s.n}>
              <button
                type="button"
                className={`stepper-node ${clickable ? "clickable" : ""} ${
                  isActive ? "active" : ""
                }`}
                disabled={!clickable}
                onClick={() =>
                  clickable &&
                  onSelectWizardStep &&
                  onSelectWizardStep(wizardKey!)
                }
                title={clickable ? `View ${s.label}` : (st.detail ?? undefined)}
              >
                <span className={`stepper-dot ${st.status}`}>
                  {st.status === "complete" ? "✓" : s.n}
                </span>
                <span className="stepper-label">{s.label}</span>
              </button>
              {i < STAGE_LIST.length - 1 && (
                <div
                  className={`stepper-connector ${
                    st.status === "complete" ? "complete" : ""
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StepperStatus({
  stages,
  progressPct,
}: {
  stages: StagesMap;
  progressPct: number;
}) {
  const running = STAGE_LIST.find((s) => stages[s.n].status === "in-progress");
  const lastComplete = [...STAGE_LIST]
    .reverse()
    .find((s) => stages[s.n].status === "complete");
  const current = running ?? lastComplete;
  if (!current) return null;

  return (
    <div className="stepper-status-compact">
      <span
        className={`stepper-status-compact-dot ${
          running ? "running" : "complete"
        }`}
      />
      <span className="stepper-status-compact-text">
        {running ? `${current.label} in progress` : `${current.label} complete`}
      </span>
      <span className="stepper-status-compact-pct">{progressPct}%</span>
    </div>
  );
}
