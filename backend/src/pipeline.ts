import { loadStore, INDICATION_TO_SPECIALTY } from "./excelStore.js";
import { generateRecommendation, llmStatus } from "./llm.js";
import type { PipelineInput, SendFn, RankedSite, RiskLevel } from "./types.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Small artificial pauses between structured stages so the progress bar is
// actually visible — filtering an in-memory array takes milliseconds, but a
// progress UI that flashes through 8 stages instantly isn't useful to watch.
// Remove these once you're wiring this up to genuinely slow steps (e.g. a
// real external API call per stage) instead of an in-memory Excel dataset.
const STEP_DELAY_MS = 450;

export const STAGE_NAMES: Record<number, string> = {
  1: "Clinical Trial Requirements",
  2: "Region / Country Selection",
  3: "Patient Population Analysis",
  4: "Candidate Site Identification",
  5: "Site Evaluation",
  6: "AI Risk Assessment",
  7: "Site Ranking",
  8: "Final Recommendation",
};

export async function runPipeline(
  input: PipelineInput,
  send: SendFn,
): Promise<void> {
  const store = loadStore();
  const { indication, phase, sampleSize } = input;

  if (!indication || !INDICATION_TO_SPECIALTY[indication]) {
    throw new Error(
      `Unknown or missing indication "${indication}". Valid options: ${store.indications.join(", ")}`,
    );
  }
  const specialty = INDICATION_TO_SPECIALTY[indication];

  // ---- Stage 1 — Requirements (already given by the caller) ----
  send("stage", {
    stage: 1,
    name: STAGE_NAMES[1],
    status: "complete",
    detail: `${indication} · ${phase || "n/a"} · target n=${sampleSize || "n/a"}`,
  });
  await sleep(STEP_DELAY_MS);

  // ---- Stage 2 — Region / Country Selection ----
  send("stage", { stage: 2, name: STAGE_NAMES[2], status: "in-progress" });
  const regionRows = store.regionData.filter(
    (r) => r.Indication === indication,
  );
  if (regionRows.length === 0) {
    throw new Error(`No Region_Data rows found for indication "${indication}"`);
  }
  const rankedRegions = [...regionRows].sort((a, b) => {
    const scoreOf = (r: typeof a) =>
      r["Prevalence (per 100k)"] -
      r["Regulatory Approval Time (weeks)"] * 5 -
      r["Active Competing Trials"] * 3;
    return scoreOf(b) - scoreOf(a);
  });
  const topRegion = rankedRegions[0];
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 2,
    name: STAGE_NAMES[2],
    status: "complete",
    detail: `Selected ${topRegion.Region}, ${topRegion.Country}`,
    data: rankedRegions.slice(0, 5).map((r) => ({
      region: r.Region,
      country: r.Country,
      prevalence: r["Prevalence (per 100k)"],
      regulatoryWeeks: r["Regulatory Approval Time (weeks)"],
      competingTrials: r["Active Competing Trials"],
    })),
  });

  // ---- Stage 3 — Patient Population Analysis ----
  send("stage", { stage: 3, name: STAGE_NAMES[3], status: "in-progress" });
  // Illustrative estimate only (prevalence-per-100k x an assumed catchment size).
  // Swap this for a real population/EHR-based estimate in production — see the
  // data-source reference sheet for the WHO / IHME / RWD sources discussed earlier.
  const ASSUMED_CATCHMENT = 5_000_000;
  const estimatedPatients = Math.round(
    (topRegion["Prevalence (per 100k)"] / 100000) * ASSUMED_CATCHMENT,
  );
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 3,
    name: STAGE_NAMES[3],
    status: "complete",
    detail: `~${estimatedPatients.toLocaleString()} estimated eligible patients (illustrative)`,
  });

  // ---- Stage 4 — Candidate Site Identification ----
  send("stage", { stage: 4, name: STAGE_NAMES[4], status: "in-progress" });
  const candidateSites = store.sites.filter(
    (s) => s.Region === topRegion.Region && s["Therapeutic Area"] === specialty,
  );
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 4,
    name: STAGE_NAMES[4],
    status: "complete",
    detail: `${candidateSites.length} candidate site(s) found in ${topRegion.Region}`,
  });

  if (candidateSites.length === 0) {
    throw new Error(
      `No candidate sites found for ${specialty} in ${topRegion.Region}. Try a different indication.`,
    );
  }

  // ---- Stage 5 — Site Evaluation (score already computed by an Excel formula) ----
  send("stage", { stage: 5, name: STAGE_NAMES[5], status: "in-progress" });
  const evaluated = candidateSites.map((site) => {
    const evalRow = store.evalBySiteId.get(site["Site ID"]);
    return {
      ...site,
      siteId: site["Site ID"], // camelCase aliases — the Excel columns have spaces,
      siteName: site["Site Name"], // which downstream code (and the LLM prompt) reads as .siteId/.siteName
      suitabilityScore: evalRow ? evalRow["Suitability Score (0-100)"] : null,
      evalRow: evalRow!,
    };
  });
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 5,
    name: STAGE_NAMES[5],
    status: "complete",
    detail: `Scored ${evaluated.length} site(s) using Site_Evaluation data`,
  });

  // ---- Stage 6 — AI Risk Assessment (records already computed by Excel formulas) ----
  send("stage", { stage: 6, name: STAGE_NAMES[6], status: "in-progress" });
  const withRisk: RankedSite[] = evaluated.map((site) => {
    const risks = store.risksBySiteId.get(site["Site ID"]) || [];
    const highCount = risks.filter(
      (r) => r["Overall Risk Rating"] === "High",
    ).length;
    const medCount = risks.filter(
      (r) => r["Overall Risk Rating"] === "Medium",
    ).length;
    const overallRisk: RiskLevel =
      highCount > 0 ? "High" : medCount > 0 ? "Medium" : "Low";
    return {
      ...site,
      risks,
      highRiskCount: highCount,
      mediumRiskCount: medCount,
      overallRisk,
    };
  });
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 6,
    name: STAGE_NAMES[6],
    status: "complete",
    detail: `Risk-scored ${withRisk.length} site(s) across ${withRisk.reduce((n, s) => n + s.risks.length, 0)} risk records`,
  });

  // ---- Stage 7 — Site Ranking ----
  send("stage", { stage: 7, name: STAGE_NAMES[7], status: "in-progress" });
  const ranked = [...withRisk]
    .filter((s) => s.suitabilityScore !== null)
    .sort(
      (a, b) => (b.suitabilityScore as number) - (a.suitabilityScore as number),
    )
    .slice(0, 10);
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 7,
    name: STAGE_NAMES[7],
    status: "complete",
    data: ranked.map((s, i) => ({
      rank: i + 1,
      siteId: s.siteId,
      siteName: s.siteName,
      region: s.Region,
      suitabilityScore: s.suitabilityScore,
      riskLevel: s.overallRisk,
      highRiskCount: s.highRiskCount,
    })),
  });

  if (ranked.length === 0) {
    throw new Error(
      "No sites had a computable Suitability Score — check Site_Evaluation formulas.",
    );
  }

  // ---- Stage 8 — Final Recommendation (GPT-4.1, or mock if no API key) ----
  const status = llmStatus();
  send("stage", {
    stage: 8,
    name: STAGE_NAMES[8],
    status: "in-progress",
    llm: status.configured ? status.model : "mock (no API key configured)",
  });
  const top = ranked[0];
  const recommendation = await generateRecommendation({
    input,
    topRegion,
    estimatedPatients,
    top,
  });
  send("stage", {
    stage: 8,
    name: STAGE_NAMES[8],
    status: "complete",
    llm: recommendation.llm,
    data: {
      region: topRegion.Region,
      country: topRegion.Country,
      estimatedPatients,
      recommendedSite: top.siteName,
      siteId: top.siteId,
      suitabilityScore: top.suitabilityScore,
      riskLevel: top.overallRisk,
      highRiskCount: top.highRiskCount,
      text: recommendation.text,
    },
  });
}
