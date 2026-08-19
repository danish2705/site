import { Router } from "express";
import { postSiteCombination } from "../controllers/siteCombination.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const siteCombinationRoutes = Router();

siteCombinationRoutes.post(
  "/site-combination",
  asyncHandler(postSiteCombination),
);
