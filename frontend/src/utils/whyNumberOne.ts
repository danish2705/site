import type { ComponentScores, FinalResult } from "../types";

const COMPONENT_LABELS: Record<keyof ComponentScores, string> = {
  recruitment: "Recruitment potential",
  quality: "Protocol/quality fit",
  retention: "Retention",
  diversity: "Diversity",
  cost: "Cost efficiency",
};

const COMPONENT_ORDER: (keyof ComponentScores)[] = [
  "recruitment",
  "quality",
  "retention",
  "diversity",
  "cost",
];

const STRONG_THRESHOLD = 78;
const WEAK_THRESHOLD = 60;

export interface WhyNumberOne {
  strengths: string[];
  watchOuts: string[];
  conclusion: string;
}

export function deriveWhyNumberOne(site: FinalResult): WhyNumberOne {
  const strengths: string[] = [];
  const watchOuts: string[] = [];

  for (const key of COMPONENT_ORDER) {
    const raw = site.components[key];
    if (raw === null || raw === undefined || Number.isNaN(Number(raw))) continue;
    const value = Number(raw);
    const label = COMPONENT_LABELS[key];
    if (value >= STRONG_THRESHOLD) {
      strengths.push(`${label} scores ${value.toFixed(0)}/100`);
    } else if (value < WEAK_THRESHOLD) {
      watchOuts.push(`${label} is comparatively weak at ${value.toFixed(0)}/100`);
    }
  }

  if (site.meetsRequirements) {
    strengths.push("Meets every eligibility/protocol requirement checked");
  } else {
    for (const check of site.requirementChecks) {
      if (!check.pass) {
        watchOuts.push(
          `${check.criterion}: requires ${check.required}, site has ${check.actual}`,
        );
      }
    }
  }

  if (site.riskLevel === "Low") {
    strengths.push("Overall operational risk rated Low");
  } else {
    watchOuts.push(
      `Overall operational risk rated ${site.riskLevel}` +
        (site.highRiskCount > 0 ? ` (${site.highRiskCount} high-severity item(s))` : ""),
    );
  }

  if (site.confidence !== "High") {
    watchOuts.push(`Recommendation confidence is ${site.confidence}, not High`);
  }

  if (strengths.length === 0) {
    strengths.push("Best-available option among the candidates analyzed");
  }

  return {
    strengths: strengths.slice(0, 6),
    watchOuts: watchOuts.slice(0, 6),
    conclusion: site.text,
  };
}
