import type { Request, Response } from "express";
import {
  buildCombinedCatchment,
  buildLiveSiteMapData,
  type CombinedCatchmentSiteInput,
} from "../pipeline/liveMapData.js";
import { resolveSpecialty } from "../pipeline/liveIndications.js";
import { getStudyByNctId } from "../services/ctgov.client.js";
import { badRequest } from "../utils/httpError.js";

export async function getLiveSiteMap(
  req: Request,
  res: Response,
): Promise<void> {
  const indication = String(req.query.indication || "").trim();
  if (!indication) {
    throw badRequest('Query param "indication" is required.');
  }
  const country = req.query.country ? String(req.query.country).trim() : "";
  const radiusMiles = req.query.radiusMiles
    ? Number(req.query.radiusMiles)
    : undefined;
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

  let specialty = "";
  try {
    specialty = await resolveSpecialty(indication);
  } catch (err) {
    throw badRequest((err as Error).message);
  }

  const nctId = req.query.nctId ? String(req.query.nctId).trim() : "";
  const facilitiesOverride = nctId
    ? (await getStudyByNctId(nctId))?.facilities
    : undefined;

  const response = await buildLiveSiteMapData({
    indication,
    specialty,
    country: country || undefined,
    radiusMiles,
    ageGroups,
    facilitiesOverride,
  });

  res.json(response);
}

export async function getCombinedCatchment(
  req: Request,
  res: Response,
): Promise<void> {
  const { indication, country, radiusMiles, sites, ageGroups } = req.body ?? {};

  if (!indication || typeof indication !== "string") {
    throw badRequest('Body field "indication" is required.');
  }
  if (!country || typeof country !== "string") {
    throw badRequest('Body field "country" is required.');
  }
  if (!Array.isArray(sites) || sites.length === 0) {
    throw badRequest('Body field "sites" must be a non-empty array.');
  }

  const parsedSites: CombinedCatchmentSiteInput[] = sites.map(
    (s: unknown, i: number) => {
      const site = s as Record<string, unknown>;
      const lat = Number(site.lat);
      const lng = Number(site.lng);
      const netAvailablePatients = Number(site.netAvailablePatients);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !Number.isFinite(netAvailablePatients)
      ) {
        throw badRequest(
          `sites[${i}] must have numeric lat, lng, and netAvailablePatients.`,
        );
      }
      return {
        siteId: typeof site.siteId === "string" ? site.siteId : `SITE-${i}`,
        lat,
        lng,
        netAvailablePatients,
      };
    },
  );

  let specialty = "";
  try {
    specialty = await resolveSpecialty(indication);
  } catch (err) {
    throw badRequest((err as Error).message);
  }

  const response = await buildCombinedCatchment({
    indication,
    specialty,
    country,
    radiusMiles: radiusMiles ? Number(radiusMiles) : undefined,
    sites: parsedSites,
    ageGroups: Array.isArray(ageGroups)
      ? ageGroups.map((g: unknown) => String(g)).filter(Boolean)
      : [],
  });

  res.json(response);
}
