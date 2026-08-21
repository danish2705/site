/**
 * The 8-step guided workflow nav. Every key here maps 1:1 to an existing
 * page of the app — nothing here introduces new content, it's the ordered
 * list the persistent WorkflowNav (top bar) and WizardNextLink (per-page
 * back/forward) both walk. Replaces the old 5-entry WIZARD_STEPS in
 * constants/pipeline.ts, which only covered predict/competing/risk/ranking/
 * recommendation and had no notion of the (now 3, previously tab-embedded)
 * Site Map pages.
 */
export type WorkflowStep =
  | "predict"
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
  { key: "predict", label: "Predict Region", hash: "#/predict" },
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

export const DEFAULT_WORKFLOW_STEP: WorkflowStep = "predict";

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
