import type { Request, Response } from "express";
import { predictRegion } from "../llm/regionPredictor.js";
import type { PipelineInput } from "../types.js";
import { badRequest } from "../utils/httpError.js";

export async function postPredictRegion(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    res.json(await predictRegion((req.body || {}) as PipelineInput));
  } catch (err) {
    throw badRequest((err as Error).message);
  }
}
