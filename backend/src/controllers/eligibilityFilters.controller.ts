import type { Request, Response } from "express";
import { buildEligibilityFilterSet } from "../pipeline/eligibilityFilters.js";
import { badRequest } from "../utils/httpError.js";

/**
 * GET /api/eligibility-filters?indication=...
 *
 * Powers the Site Map's "Net Available" filter dropdown — Srikanth's
 * inclusion/exclusion-criteria ask, but interactive: real disclosed
 * eligibility criteria text plus an LLM-estimated exclusion percentage per
 * criterion, so the user can toggle criteria on/off and see an adjusted
 * (illustrative) patient count. See pipeline/eligibilityFilters.ts for
 * exactly what's live vs. LLM-estimated vs. unavailable in the response.
 */
export async function getEligibilityFilters(
  req: Request,
  res: Response,
): Promise<void> {
  const indication = String(req.query.indication || "").trim();
  if (!indication) {
    throw badRequest('Query param "indication" is required.');
  }

  const result = await buildEligibilityFilterSet(indication);
  res.json(result);
}
