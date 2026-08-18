import type { Request, Response } from "express";
import { buildLiveSiteMapData } from "../pipeline/liveMapData.js";
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
