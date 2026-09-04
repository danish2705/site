import type { ComponentScores, FinalResult } from "../types";

const COMPONENT_LABELS: Record<keyof ComponentScores, string> = {
  recruitment: "Recruitment potential",
  quality: "Protocol/quality fit",
  retention: "Retention",
  diversity: "Diversity",
  cost: "Cost efficiency",
};

// Order mirrors ScoreBreakdown's weighting (recruitment 35%, quality 25%,
// retention 20%, diversity 10%, cost 10%) so strengths/watch-outs surface
// the components that most influenced the overall score first.
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
  /** The existing free-text AI narrative (FinalResult.text) — kept verbatim
      as its own labeled section rather than folded into strengths/watch-outs,
      since it's model-generated prose, not a discrete, structured fact. */
  conclusion: string;
}

/**
 * Derives the "Why #1?" Strengths / Watch-outs / AI conclusion breakdown
 * (redesign spec item 9) from data the backend already returns on
 * FinalResult — no new API surface needed. Strengths/watch-outs are picked
 * from the same 5 weighted component scores ScoreBreakdown.tsx already
 * renders as bars, plus the pass/fail requirement checklist and the overall
 * risk/confidence ratings, so this stays in sync with whatever those
 * numbers already say elsewhere on the page.
 */
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
