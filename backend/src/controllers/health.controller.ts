import type { Request, Response } from "express";
import { loadStore } from "../repository/excelStore.js";
import { llmStatus } from "../llm/client.js";
import { dbPing, dbStatus } from "../db.js";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const store = loadStore();
  res.json({
    ok: true,
    excelFile: store.filePath,
    sites: store.sites.length,
    riskRecords: store.risks.length,
    llm: llmStatus(),
    db: { ...dbStatus(), ...(await dbPing()) },
  });
}
