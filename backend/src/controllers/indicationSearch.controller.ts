import type { Request, Response } from "express";
import { searchConditions } from "../services/ctgov.client.js";

export async function searchIndications(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  const results = q.length >= 2 ? await searchConditions(q) : [];
  res.json({ query: q, results });
}
