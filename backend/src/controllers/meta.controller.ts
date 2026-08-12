import type { Request, Response } from "express";
import {
  INDICATION_TO_SPECIALTY,
  loadStore,
} from "../repository/excelStore.js";

export function getMeta(_req: Request, res: Response): void {
  const store = loadStore();
  res.json({
    indications: store.indications,
    regions: store.regions,
    regionOptions: store.regionOptions,
    specialties: INDICATION_TO_SPECIALTY,
  });
}
