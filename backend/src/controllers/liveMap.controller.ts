import type { Request, Response } from "express";
import {
  buildCombinedCatchment,
  buildLiveSiteMapData,
  type CombinedCatchmentSiteInput,
} from "../pipeline/liveMapData.js";
import { resolveSpecialty } from "../pipeline/liveIndications.js";
import { badRequest } from "../utils/httpError.js";

/**
 * GET /api/live-map?indication=...&country=...&radiusMiles=...
 *
 * Data for the "Site Map" tab next to Predicted Region/Country — see
 * pipeline/liveMapData.ts for exactly what's live vs. synthetic vs.
 * approximate in the response. `country` is optional: omit it to see sites
 * across every country ClinicalTrials.gov returns for this indication (a
 * global view), matching the rest of this app's global region taxonomy.
 */
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

  let specialty = "";
  try {
    specialty = await resolveSpecialty(indication);
  } catch (err) {
    throw badRequest((err as Error).message);
  }

  const response = await buildLiveSiteMapData({
    indication,
    specialty,
    country: country || undefined,
    radiusMiles,
  });

  res.json(response);
}

/**
 * POST /api/live-map/combined-catchment
 * Body: { indication, country, radiusMiles?, sites: [{ siteId, lat, lng, netAvailablePatients }] }
 *
 * Answers "if I pick these sites together, how many UNIQUE patients can I
 * actually reach?" — de-duplicating any catchment overlap between nearby
 * selected sites instead of just summing each site's own (independently
 * computed) number, which double-counts patients reachable by more than one
 * site. See pipeline/liveMapData.ts's buildCombinedCatchment.
 */
export async function getCombinedCatchment(
  req: Request,
  res: Response,
): Promise<void> {
  const { indication, country, radiusMiles, sites } = req.body ?? {};

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
  });

  res.json(response);
}
