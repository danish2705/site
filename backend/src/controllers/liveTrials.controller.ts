import type { Request, Response } from "express";
import {
  getActiveCompetingTrialsCount,
  getCompletedTrialBenchmarks,
  getFacilitiesForCondition,
} from "../services/ctgov.client.js";
import { badRequest } from "../utils/httpError.js";
import { config } from "../config.js";
import type { LiveTrialLandscapeResponse } from "../types.js";

export async function getLiveTrialLandscape(
  req: Request,
  res: Response,
): Promise<void> {
  const indication = String(req.query.indication || "").trim();
  const country = req.query.country ? String(req.query.country).trim() : "";
  const ageGroupsRaw = req.query.ageGroups;
  const ageGroups = (
    Array.isArray(ageGroupsRaw)
      ? ageGroupsRaw.map((v) => String(v))
      : typeof ageGroupsRaw === "string" && ageGroupsRaw.length > 0
        ? ageGroupsRaw.split(",")
        : []
  )
    .map((g) => g.trim())
    .filter(Boolean);

  if (!indication) {
    throw badRequest('Query param "indication" is required.');
  }

  const warnings: string[] = [];

  const [competingResult, facilitiesResult, benchmarkResult] =
    await Promise.allSettled([
      getActiveCompetingTrialsCount(indication, country),
      getFacilitiesForCondition(indication, {
        country: country || undefined,
        ageGroups,
        pageSize: 200,
      }),
      getCompletedTrialBenchmarks(indication),
    ]);

  const activeCompetingTrials =
    competingResult.status === "fulfilled" ? competingResult.value : null;
  if (competingResult.status === "rejected") {
    warnings.push("Could not fetch the live competing-trials count.");
  }

  const facilities =
    facilitiesResult.status === "fulfilled" ? facilitiesResult.value : [];
  if (facilitiesResult.status === "rejected") {
    warnings.push("Could not fetch the live facility cross-check list.");
  }

  const benchmark =
    benchmarkResult.status === "fulfilled"
      ? benchmarkResult.value
      : {
          sampleCount: 0,
          phaseDistribution: {},
          medianSampleSize: null,
          medianDurationMonths: null,
          medianEnrollmentRatePerMonth: null,
        };
  if (benchmarkResult.status === "rejected") {
    warnings.push("Could not fetch completed-trial benchmarks.");
  }

  const response: LiveTrialLandscapeResponse = {
    indication,
    country: country || null,
    activeCompetingTrials,
    facilities,
    competingStatuses: config.competingTrials.statuses,
    benchmark,
    fetchedAt: new Date().toISOString(),
    warnings,
  };

  res.json(response);
}
