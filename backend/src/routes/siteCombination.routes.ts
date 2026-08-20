import { Router } from "express";
import {
  postSiteCombination,
  postOutreachDraft,
} from "../controllers/siteCombination.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const siteCombinationRoutes = Router();

siteCombinationRoutes.post(
  "/site-combination",
  asyncHandler(postSiteCombination),
);

siteCombinationRoutes.post(
  "/outreach-draft",
  asyncHandler(postOutreachDraft),
);
