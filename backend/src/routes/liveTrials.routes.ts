import { Router } from "express";
import { getLiveTrialLandscape } from "../controllers/liveTrials.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const liveTrialsRoutes = Router();

liveTrialsRoutes.get("/live-trials", asyncHandler(getLiveTrialLandscape));
