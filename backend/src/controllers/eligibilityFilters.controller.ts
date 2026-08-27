import type { Request, Response } from "express";
import { buildEligibilityFilterSet } from "../pipeline/eligibilityFilters.js";
import { badRequest } from "../utils/httpError.js";

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
