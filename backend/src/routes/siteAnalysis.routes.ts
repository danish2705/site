import { Router } from "express";
import { postSiteAnalysis } from "../controllers/siteAnalysis.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const siteAnalysisRoutes = Router();

siteAnalysisRoutes.post("/site-analysis", asyncHandler(postSiteAnalysis));
