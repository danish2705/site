import { loadStore, INDICATION_TO_SPECIALTY } from "./excelStore.js";
import { generateRecommendation, llmStatus } from "./llm.js";
import type {
  PipelineInput,
  SendFn,
  RankedSite,
  RiskLevel,
  RiskRow,
  RiskRecord,
} from "./types.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Formats a Risk_Register "Date Identified" cell for display, tolerating
// the three shapes the xlsx library can hand back depending on how the
// sheet's cells are formatted: a JS Date, a plain string, or (if the cell
// wasn't read with cellDates) an Excel serial-day number.
function formatRiskDate(value: string | Date | number): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const EXCEL_EPOCH_OFFSET_DAYS = 25569; // days between 1899-12-30 and 1970-01-01
    const ms = Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  return String(value);
}

// Camel-cases a raw Risk_Register row into the shape sent to the frontend,
// so risks render as individual records (one row per risk) rather than
// just an aggregate count/badge.
function toRiskRecord(r: RiskRow): RiskRecord {
  return {
    riskId: r["Risk ID"],
    siteId: r["Site ID"],
    category: r["Risk Category"],
    description: r.Description,
    likelihood: r.Likelihood,
    impact: r.Impact,
    overallRisk: r["Overall Risk Rating"],
    dateIdentified: formatRiskDate(r["Date Identified"]),
    status: r.Status,
    mitigationPlan: r["Mitigation Plan"],
    owner: r.Owner,
    riskScore: r["Risk Score (Numeric)"],
  };
}

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
  // Region/Country is now also a pipeline INPUT: the frontend lets the user
  // multi-select candidate regions/countries. When present, we rank and pick
  // only among that user-selected set; otherwise we fall back to ranking
  // every region on file for the indication (previous behavior).
  send("stage", { stage: 2, name: STAGE_NAMES[2], status: "in-progress" });
  let regionRows = store.regionData.filter((r) => r.Indication === indication);
  if (regionRows.length === 0) {
    throw new Error(`No Region_Data rows found for indication "${indication}"`);
  }

  const userSelectedRegions = (input.regions || []).filter(
    (r) => r && r.region && r.country,
  );
  if (userSelectedRegions.length > 0) {
    const selectedSet = new Set(
      userSelectedRegions.map((r) => `${r.region}||${r.country}`),
    );
    const filtered = regionRows.filter((r) =>
      selectedSet.has(`${r.Region}||${r.Country}`),
    );
    if (filtered.length === 0) {
      throw new Error(
        `None of your selected Region/Country options have data for indication "${indication}". ` +
          `Pick a different region/country combination for this indication.`,
      );
    }
    regionRows = filtered;
  }

  const rankedRegions = [...regionRows].sort((a, b) => {
    const scoreOf = (r: typeof a) =>
      r["Prevalence (per 100k)"] -
      r["Regulatory Approval Time (weeks)"] * 5 -
      r["Active Competing Trials"] * 3;
    return scoreOf(b) - scoreOf(a);
  });

  // Region_Data intentionally covers more geography than Candidate_Sites
  // has actual sites for (a broader landscape scan — see the dataset's
  // README), so the top-scoring region by the formula above frequently
  // has zero candidate sites for this indication's specialty. Picking it
  // blindly would dead-end Stage 4 with "no candidate sites found" even
  // though a lower-scoring — but still valid — region has sites. Walk the
  // ranked list and take the first region that actually has a site.
  const bestByFormula = rankedRegions[0];
  const topRegion = rankedRegions.find((r) =>
    store.sites.some(
      (s) => s.Region === r.Region && s["Therapeutic Area"] === specialty,
    ),
  );
  if (!topRegion) {
    throw new Error(
      `No candidate sites found for ${specialty} (required by "${indication}") in any of the ` +
        `${rankedRegions.length} region(s) considered${
          userSelectedRegions.length > 0
            ? " among your selected Region/Country options"
            : ""
        }. Try a different indication or region/country selection.`,
    );
  }
  await sleep(STEP_DELAY_MS);
  send("stage", {
    stage: 2,
    name: STAGE_NAMES[2],
    status: "complete",
    detail:
      (userSelectedRegions.length > 0
        ? `Selected ${topRegion.Region}, ${topRegion.Country} (best fit with available sites among your ${userSelectedRegions.length} chosen option(s))`
        : `Selected ${topRegion.Region}, ${topRegion.Country} (auto-picked — no region/country input given)`) +
      (topRegion !== bestByFormula
        ? ` — ${bestByFormula.Region}, ${bestByFormula.Country} scored higher but had no ${specialty} candidate sites`
        : ""),
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
    // One row per candidate site with its full risk register (individual
    // records), so the UI can render Stage 6's output — positioned above
    // Stage 7's ranking output — before ranking/top-10 narrowing happens.
    data: withRisk.map((s) => ({
      siteId: s.siteId,
      siteName: s.siteName,
      region: s.Region,
      overallRisk: s.overallRisk,
      highRiskCount: s.highRiskCount,
      mediumRiskCount: s.mediumRiskCount,
      riskRecords: s.risks.map(toRiskRecord),
    })),
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
    // Individual risk records per site are already covered by Stage 6's
    // output (rendered above this table) — this stays a lean summary row.
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
    // The recommended site's full risk register is already covered by
    // Stage 6's output (tagged "Recommended" there) — no need to repeat it.
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
