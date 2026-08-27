import type { Request, Response } from "express";
import { optimizeSiteCombination } from "../pipeline/siteCombinationOptimizer.js";
import { buildLiveRegionRow } from "../pipeline/liveRegionMetrics.js";
import { resolveSpecialty } from "../pipeline/liveIndications.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";
import { badRequest } from "../utils/httpError.js";
import { config } from "../config.js";
import type { SiteCombinationRequestSite } from "../types.js";
import {
  buildOutreachDrafts,
  type OutreachDraftSiteInput,
} from "../pipeline/outreachDraft.js";

function regionLabelForCountry(country: string): string {
  const match = REGION_DEFINITIONS.find(
    (r) => r.country.toLowerCase() === country.toLowerCase(),
  );
  return match?.region ?? "Global";
}

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
      const recruitablePatientsRaw =
        site.recruitablePatients ?? site.netAvailablePatients;
      const recruitablePatients = Number(recruitablePatientsRaw);
      if (!Number.isFinite(recruitablePatients)) {
        throw badRequest(`sites[${i}].recruitablePatients must be numeric.`);
      }
      const riskScoreRaw = site.riskScore;
      const riskScore =
        riskScoreRaw === null || riskScoreRaw === undefined
          ? null
          : Number(riskScoreRaw);
      const baseCostRaw = site.baseCostUsd;
      const perPatientCostRaw = site.perPatientCostUsd;
      const baseCostUsd =
        baseCostRaw === null || baseCostRaw === undefined
          ? null
          : Number(baseCostRaw);
      const perPatientCostUsd =
        perPatientCostRaw === null || perPatientCostRaw === undefined
          ? null
          : Number(perPatientCostRaw);
      return {
        siteId: typeof site.siteId === "string" ? site.siteId : `SITE-${i}`,
        siteName:
          typeof site.siteName === "string" ? site.siteName : `Site ${i + 1}`,
        city: typeof site.city === "string" ? site.city : null,
        country: typeof site.country === "string" ? site.country : null,
        recruitablePatients,
        riskScore: riskScore !== null && Number.isFinite(riskScore) ? riskScore : null,
        baseCostUsd:
          baseCostUsd !== null && Number.isFinite(baseCostUsd) ? baseCostUsd : null,
        perPatientCostUsd:
          perPatientCostUsd !== null && Number.isFinite(perPatientCostUsd)
            ? perPatientCostUsd
            : null,
      };
    },
  );

  let specialty = "";
  try {
    specialty = await resolveSpecialty(indication);
  } catch (err) {
    throw badRequest((err as Error).message);
  }

  let avgCostPerPatientUsd: number | null = null;
  try {
    const regionRow = await buildLiveRegionRow({
      region: regionLabelForCountry(country),
      country,
      indication,
      specialty,
    });
    avgCostPerPatientUsd =
      regionRow.regionMetricsSource === "llm-estimated" ||
      regionRow.regionMetricsSource === "claims-synthetic"
        ? regionRow["Avg Cost per Patient (USD)"]
        : null;
  } catch {
  }

  const response = optimizeSiteCombination(
    parsedSites,
    target,
    avgCostPerPatientUsd,
    config.siteCombination.assumedConsentRate,
  );
  res.json(response);
}

export async function postOutreachDraft(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    indication,
    phase,
    targetEnrollment,
    senderOrganization,
    sites,
  } = req.body ?? {};

  if (!indication || typeof indication !== "string") {
    throw badRequest('Body field "indication" is required.');
  }
  if (!Array.isArray(sites) || sites.length === 0) {
    throw badRequest('Body field "sites" must be a non-empty array.');
  }

  const parsedSites: OutreachDraftSiteInput[] = sites.map(
    (s: unknown, i: number) => {
      const site = s as Record<string, unknown>;
      return {
        siteId: typeof site.siteId === "string" ? site.siteId : `SITE-${i}`,
        siteName:
          typeof site.siteName === "string" ? site.siteName : `Site ${i + 1}`,
        city: typeof site.city === "string" ? site.city : null,
        country: typeof site.country === "string" ? site.country : null,
      };
    },
  );

  const targetNum = Number(targetEnrollment);

  const result = buildOutreachDrafts({
    sites: parsedSites,
    indication,
    phase: typeof phase === "string" ? phase : undefined,
    targetEnrollment: Number.isFinite(targetNum) ? targetNum : undefined,
    senderOrganization:
      typeof senderOrganization === "string" ? senderOrganization : undefined,
  });
  res.json(result);
}
