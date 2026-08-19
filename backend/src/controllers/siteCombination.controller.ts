import type { Request, Response } from "express";
import { optimizeSiteCombination } from "../pipeline/siteCombinationOptimizer.js";
import { buildLiveRegionRow } from "../pipeline/liveRegionMetrics.js";
import { resolveSpecialty } from "../pipeline/liveIndications.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";
import { badRequest } from "../utils/httpError.js";
import type { SiteCombinationRequestSite } from "../types.js";

function regionLabelForCountry(country: string): string {
  const match = REGION_DEFINITIONS.find(
    (r) => r.country.toLowerCase() === country.toLowerCase(),
  );
  return match?.region ?? "Global";
}

/**
 * POST /api/site-combination
 * Body: { indication, country, targetEnrollment, sites: [{ siteId, siteName, netAvailablePatients, riskScore }] }
 *
 * The "which combination of sites gets me to my enrollment target for the
 * least cost/risk" mechanic from Srikanth's 2024 intern demo — see
 * pipeline/siteCombinationOptimizer.ts for the (greedy, not exhaustive)
 * method and its caveats. `sites` is the candidate list already returned by
 * GET /api/live-map for this indication/country — this endpoint doesn't
 * re-fetch it, so the combination is always computed over exactly what the
 * caller is already looking at.
 */
export async function postSiteCombination(
  req: Request,
  res: Response,
): Promise<void> {
  const { indication, country, targetEnrollment, sites } = req.body ?? {};

  if (!indication || typeof indication !== "string") {
    throw badRequest('Body field "indication" is required.');
  }
  if (!country || typeof country !== "string") {
    throw badRequest('Body field "country" is required.');
  }
  const target = Number(targetEnrollment);
  if (!Number.isFinite(target) || target <= 0) {
    throw badRequest('Body field "targetEnrollment" must be a positive number.');
  }
  if (!Array.isArray(sites) || sites.length === 0) {
    throw badRequest('Body field "sites" must be a non-empty array.');
  }

  const parsedSites: SiteCombinationRequestSite[] = sites.map(
    (s: unknown, i: number) => {
      const site = s as Record<string, unknown>;
      const netAvailablePatients = Number(site.netAvailablePatients);
      if (!Number.isFinite(netAvailablePatients)) {
        throw badRequest(`sites[${i}].netAvailablePatients must be numeric.`);
      }
      const riskScoreRaw = site.riskScore;
      const riskScore =
        riskScoreRaw === null || riskScoreRaw === undefined
          ? null
          : Number(riskScoreRaw);
      return {
        siteId: typeof site.siteId === "string" ? site.siteId : `SITE-${i}`,
        siteName:
          typeof site.siteName === "string" ? site.siteName : `Site ${i + 1}`,
        netAvailablePatients,
        riskScore: riskScore !== null && Number.isFinite(riskScore) ? riskScore : null,
      };
    },
  );

  let specialty = "";
  try {
    specialty = await resolveSpecialty(indication);
  } catch (err) {
    throw badRequest((err as Error).message);
  }

  // Reuse the same LLM-estimated avg-cost-per-patient figure already shown
  // elsewhere in the app (region scoring, candidate-site estimates) rather
  // than inventing a second cost source — null (not 0) if it's unavailable,
  // so the optimizer and the UI can tell "no cost data" apart from "free."
  let avgCostPerPatientUsd: number | null = null;
  try {
    const regionRow = await buildLiveRegionRow({
      region: regionLabelForCountry(country),
      country,
      indication,
      specialty,
    });
    avgCostPerPatientUsd =
      regionRow.regionMetricsSource === "llm-estimated"
        ? regionRow["Avg Cost per Patient (USD)"]
        : null;
  } catch {
    // Leave avgCostPerPatientUsd null — cost-based figures on the response
    // will read as unavailable rather than silently showing $0.
  }

  const response = optimizeSiteCombination(
    parsedSites,
    target,
    avgCostPerPatientUsd,
  );
  res.json(response);
}
