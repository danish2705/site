export type WorkflowStep =
  | "site-map-global"
  | "site-map-details"
  | "site-combination"
  | "competing"
  | "risk"
  | "ranking"
  | "recommendation";

export interface WorkflowStepDef {
  key: WorkflowStep;
  label: string;
  /** URL hash for this step — enables real browser Back/Forward + shareable links without any backend routing change. */
  hash: string;
}

export const WORKFLOW_STEPS: WorkflowStepDef[] = [
  { key: "site-map-global", label: "Site Map (Global)", hash: "#/site-map" },
  {
    key: "site-map-details",
    label: "Site Map Details",
    hash: "#/site-map/details",
  },
  {
    key: "site-combination",
    label: "Site Combination Planner",
    hash: "#/site-map/combination",
  },
  { key: "competing", label: "Ongoing Trials", hash: "#/ongoing-trials" },
  { key: "risk", label: "Risk Register", hash: "#/risk-register" },
  { key: "ranking", label: "Ranking", hash: "#/ranking" },
  {
    key: "recommendation",
    label: "Final Recommendation",
    hash: "#/recommendation",
  },
];

export const DEFAULT_WORKFLOW_STEP: WorkflowStep = "site-map-global";

export function workflowStepFromHash(hash: string): WorkflowStep | null {
  const found = WORKFLOW_STEPS.find((s) => s.hash === hash);
  return found ? found.key : null;
}

export function hashForWorkflowStep(step: WorkflowStep): string {
  return WORKFLOW_STEPS.find((s) => s.key === step)?.hash ?? WORKFLOW_STEPS[0].hash;
}

export function workflowStepLabel(step: WorkflowStep): string {
  return WORKFLOW_STEPS.find((s) => s.key === step)?.label ?? step;
}
