import {
  loadStore,
  INDICATION_TO_SPECIALTY,
} from "../repository/excelStore.js";
import { predictRegionWithLLM, llmStatus } from "./client.js";
import type {
  PipelineInput,
  RegionCandidate,
  RegionPrediction,
  RegionPredictionResponse,
} from "../types.js";

const ASSUMED_CATCHMENT = 5_000_000;

function normalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function costWeightForTier(budgetTier?: string): number {
  switch ((budgetTier || "Mid").toLowerCase()) {
    case "low":
      return 1;
    case "high":
      return 0.15;
    default:
      return 0.6;
  }
}

function buildCandidates(
  input: PipelineInput,
  specialty: string,
): { candidates: RegionCandidate[]; excludedNoSites: number } {
  const store = loadStore();
  const { sampleSize = 300, durationMonths = 18, budgetTier } = input;

  const regionRows = store.regionData.filter(
    (r) => r.Indication === input.indication,
  );

  const seen = new Set<string>();
  const raw = regionRows.filter((r) => {
    const key = `${r.Region}||${r.Country}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let excludedNoSites = 0;

  const rows = raw
    .map((r) => {
      const sites = store.sites.filter(
        (s) => s.Region === r.Region && s["Therapeutic Area"] === specialty,
      );
      if (sites.length === 0) {
        excludedNoSites += 1;
        return null;
      }

      const evals = sites
        .map((s) => store.evalBySiteId.get(s["Site ID"]))
        .filter((e): e is NonNullable<typeof e> => !!e);

      const suitabilities = evals
        .map((e) => e["Suitability Score (0-100)"])
        .filter((n): n is number => typeof n === "number");

      const enrollmentRates = evals
        .map((e) => e["Historical Enrollment Rate (pts/month)"])
        .filter((n): n is number => typeof n === "number");

      const highRiskCount = sites.reduce((n, s) => {
        const risks = store.risksBySiteId.get(s["Site ID"]) || [];
        return (
          n + risks.filter((x) => x["Overall Risk Rating"] === "High").length
        );
      }, 0);

      const avg = (arr: number[]) =>
        arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

      const avgEnrollmentRate = avg(enrollmentRates);
      const capacityPerMonth = avgEnrollmentRate * sites.length;
      const monthsToEnroll =
        capacityPerMonth > 0 ? sampleSize / capacityPerMonth : Infinity;

      return {
        region: r.Region,
        country: r.Country,
        prevalence: r["Prevalence (per 100k)"],
        regulatoryWeeks: r["Regulatory Approval Time (weeks)"],
        competingTrials: r["Active Competing Trials"],
        avgCostPerPatient: r["Avg Cost per Patient (USD)"],
        siteCount: sites.length,
        avgSuitability: Math.round(avg(suitabilities) * 10) / 10,
        bestSuitability: suitabilities.length ? Math.max(...suitabilities) : 0,
        highRiskCount,
        highRiskPerSite: Math.round((highRiskCount / sites.length) * 100) / 100,
        avgEnrollmentRate: Math.round(avgEnrollmentRate * 10) / 10,
        estimatedPatients: Math.round(
          (r["Prevalence (per 100k)"] / 100000) * ASSUMED_CATCHMENT,
        ),
        monthsToEnroll:
          monthsToEnroll === Infinity
            ? null
            : Math.round(monthsToEnroll * 10) / 10,
        score: 0, // filled in below, once the whole set is known
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return { candidates: [], excludedNoSites };

  const nPrevalence = normalize(rows.map((r) => r.prevalence));
  const nSuitability = normalize(rows.map((r) => r.avgSuitability));
  const nRegulatory = normalize(rows.map((r) => r.regulatoryWeeks));
  const nCompeting = normalize(rows.map((r) => r.competingTrials));
  const nCost = normalize(rows.map((r) => r.avgCostPerPatient));
  const nRisk = normalize(rows.map((r) => r.highRiskPerSite));
  const nDepth = normalize(rows.map((r) => r.siteCount));

  const costWeight = costWeightForTier(budgetTier);

  rows.forEach((r, i) => {
    const enrollFeasibility =
      r.monthsToEnroll === null
        ? 0
        : clamp01((durationMonths * 0.6) / r.monthsToEnroll);

    const score =
      0.22 * nPrevalence[i] + // patient pool
      0.2 * nSuitability[i] + // site quality
      0.16 * enrollFeasibility + // can it actually recruit in time
      0.12 * (1 - nRegulatory[i]) + // faster approval is better
      0.1 * (1 - nCompeting[i]) + // fewer competing trials is better
      0.1 * (1 - nRisk[i]) + // fewer high risks per site is better
      0.1 * nDepth[i] + // more candidate sites = more fallback
      0.08 * costWeight * (1 - nCost[i]); // cheaper, weighted by budget tier

    r.score = Math.round((score / (1 + 0.08 * costWeight)) * 1000) / 10;
  });

  rows.sort((a, b) => b.score - a.score);
  return { candidates: rows, excludedNoSites };
}

function heuristicPrediction(
  candidates: RegionCandidate[],
  note: string,
): RegionPrediction {
  const top = candidates[0];
  const second = candidates[1];
  const gap = second ? top.score - second.score : 100;

  const keyFactors = [
    `${top.estimatedPatients.toLocaleString()} estimated eligible patients`,
    `${top.siteCount} candidate site(s), avg suitability ${top.avgSuitability}/100`,
    `${top.regulatoryWeeks}-week regulatory approval`,
    `${top.competingTrials} active competing trial(s)`,
    `$${top.avgCostPerPatient.toLocaleString()} avg cost per patient`,
  ];

  const watchOuts: string[] = [];
  if (top.highRiskPerSite >= 1)
    watchOuts.push(
      `${top.highRiskCount} high-severity risk record(s) across ${top.siteCount} site(s)`,
    );
  if (top.monthsToEnroll !== null && top.monthsToEnroll > 12)
    watchOuts.push(
      `Estimated ~${top.monthsToEnroll} months to full enrollment at historical rates`,
    );
  if (gap < 3 && second)
    watchOuts.push(
      `${second.region} scores within ${gap.toFixed(1)} points — the two are close to interchangeable`,
    );

  return {
    region: top.region,
    country: top.country,
    confidence: gap >= 8 ? "High" : gap >= 3 ? "Medium" : "Low",
    confidenceReason: !second
      ? "Only one region has viable sites for this indication, so there is nothing to weigh it against."
      : gap >= 8
        ? `${top.region} leads the runner-up (${second.region}) by ${gap.toFixed(1)} points — a clear, not marginal, win.`
        : gap >= 3
          ? `${top.region} leads ${second.region} by ${gap.toFixed(1)} points — ahead, but not decisively.`
          : `${top.region} and ${second.region} are within ${gap.toFixed(1)} points, so the ordering could flip on small changes to trial assumptions.`,
    rationale:
      `${note} ${top.region}, ${top.country} ranks first on the weighted composite score ` +
      `(${top.score}/100) built from prevalence, site suitability, enrollment capacity, ` +
      `regulatory timeline, competing-trial load, risk density and cost.`,
    keyFactors,
    watchOuts,
    alternatives: candidates.slice(1, 3).map((c) => ({
      region: c.region,
      country: c.country,
      why: `Score ${c.score}/100 — ${c.siteCount} site(s), ${c.estimatedPatients.toLocaleString()} est. patients, ${c.regulatoryWeeks}-week approval.`,
    })),
  };
}

export async function predictRegion(
  input: PipelineInput,
): Promise<RegionPredictionResponse> {
  const store = loadStore();
  const { indication } = input;

  if (!indication || !INDICATION_TO_SPECIALTY[indication]) {
    throw new Error(
      `Unknown or missing indication "${indication}". Valid options: ${store.indications.join(", ")}`,
    );
  }
  const specialty = INDICATION_TO_SPECIALTY[indication];

  const { candidates, excludedNoSites } = buildCandidates(input, specialty);
  if (candidates.length === 0) {
    throw new Error(
      `No region on file has ${specialty} candidate sites for "${indication}", so there is nothing to predict from.`,
    );
  }

  const status = llmStatus();
  if (!status.configured) {
    return {
      llm: "mock",
      indication,
      specialty,
      candidates,
      excludedNoSites,
      prediction: heuristicPrediction(
        candidates,
        "[MOCK — no API key configured, so this is the deterministic scoring fallback rather than an LLM prediction]",
      ),
    };
  }

  try {
    const prediction = await predictRegionWithLLM({
      input,
      specialty,
      candidates: candidates.slice(0, 8),
    });

    const match = candidates.find(
      (c) =>
        c.region.toLowerCase() === (prediction.region || "").toLowerCase() &&
        c.country.toLowerCase() === (prediction.country || "").toLowerCase(),
    );
    if (!match) {
      prediction.region = candidates[0].region;
      prediction.country = candidates[0].country;
    }

    return {
      llm: status.model,
      indication,
      specialty,
      candidates,
      excludedNoSites,
      prediction,
    };
  } catch (err) {
    return {
      llm: "fallback (scoring model)",
      indication,
      specialty,
      candidates,
      excludedNoSites,
      prediction: heuristicPrediction(
        candidates,
        `[LLM call failed (${(err as Error).message}) — showing the deterministic scoring fallback.]`,
      ),
    };
  }
}
