import { Router } from "express";
import {
  createRun,
  getRunById,
  getRuns,
  removeRun,
} from "../controllers/runs.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const runsRoutes = Router();

runsRoutes.post("/runs", asyncHandler(createRun));
runsRoutes.get("/runs", asyncHandler(getRuns));
runsRoutes.get("/runs/:id", asyncHandler(getRunById));
runsRoutes.delete("/runs/:id", asyncHandler(removeRun));
