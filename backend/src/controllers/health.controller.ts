import type { Request, Response } from "express";
import { llmStatus } from "../llm/client.js";
import { dbPing, dbStatus } from "../db.js";
import { config } from "../config.js";

// No more Excel dependency here — the pipeline is fully live/LLM-sourced now,
// so health reports whether the live data source and LLM are configured
// instead of Excel workbook stats.
export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.json({
    ok: true,
    ctgov: { enabled: config.ctgov.enabled },
    llm: llmStatus(),
    db: { ...dbStatus(), ...(await dbPing()) },
  });
}
