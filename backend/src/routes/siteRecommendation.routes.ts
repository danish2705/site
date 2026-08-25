import { Router } from "express";
import { postSiteRecommendationByStatus } from "../controllers/siteRecommendation.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const siteRecommendationRoutes = Router();

siteRecommendationRoutes.post(
  "/site-recommendation-by-status",
  asyncHandler(postSiteRecommendationByStatus),
);
