import type { Request, Response } from "express";
import { searchConditions } from "../services/ctgov.client.js";

/**
 * GET /api/indication-search?q=...
 *
 * Live search over ClinicalTrials.gov's real condition vocabulary — backs
 * the Indication field's search-as-you-type, since the pre-loaded dropdown
 * (see meta.controller.ts) is capped at the top 250 most common conditions
 * by ClinicalTrials.gov's own /stats/field/values endpoint and can't surface
 * anything past that. A query shorter than 2 characters returns no results
 * rather than firing an overly broad live search on every keystroke.
 */
export async function searchIndications(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  const results = q.length >= 2 ? await searchConditions(q) : [];
  res.json({ query: q, results });
}
