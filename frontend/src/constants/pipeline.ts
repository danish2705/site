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

export type WizardStep = "predict" | "risk" | "ranking" | "recommendation";

export const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: "predict", label: "AI Prediction" },
  { key: "risk", label: "Risk Assessment" },
  { key: "ranking", label: "Site Ranking" },
  { key: "recommendation", label: "Recommendation" },
];
