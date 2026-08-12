import type { Request, Response } from "express";
import { dbStatus } from "../db.js";
import {
  deleteRun,
  getRun,
  listRuns,
  saveRun,
} from "../repository/runs.repository.js";
import type { SaveRunInput } from "../types.js";
import { HttpError, badRequest, notFoundError } from "../utils/httpError.js";

export async function createRun(req: Request, res: Response): Promise<void> {
  try {
    const saved = await saveRun((req.body || {}) as SaveRunInput);
    res.status(201).json(saved);
  } catch (err) {
    throw new HttpError(
      dbStatus().configured ? 400 : 503,
      (err as Error).message,
    );
  }
}

export async function getRuns(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await listRuns());
  } catch (err) {
    throw new HttpError(
      dbStatus().configured ? 500 : 503,
      (err as Error).message,
    );
  }
}

/** One saved run with its full ranked-site list. */
export async function getRunById(req: Request, res: Response): Promise<void> {
  try {
    res.json(await getRun(String(req.params.id)));
  } catch (err) {
    throw notFoundError((err as Error).message);
  }
}

export async function removeRun(req: Request, res: Response): Promise<void> {
  try {
    await deleteRun(String(req.params.id));
    res.status(204).end();
  } catch (err) {
    throw badRequest((err as Error).message);
  }
}
