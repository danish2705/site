export const STAGE_LIST: { n: number; label: string }[] = [
  { n: 1, label: "Clinical Trial Requirements" },
  { n: 2, label: "Region / Country Selection" },
  { n: 3, label: "Patient Population Analysis" },
  { n: 4, label: "Candidate Site Identification" },
  { n: 5, label: "Site Evaluation" },
  { n: 6, label: "AI Risk Assessment" },
  { n: 7, label: "Site Ranking" },
  { n: 8, label: "Final Recommendation" },
];

// The 5-step wizard (WIZARD_STEPS/WizardStep) that used to live here has
// been superseded by the 8-step guided workflow in constants/workflow.ts —
// see WorkflowStep/WORKFLOW_STEPS there, which also covers the 3 Site Map
// pages that previously lived as in-panel tabs.
