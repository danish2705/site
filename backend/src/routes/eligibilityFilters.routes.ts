import { Router } from "express";
import { getEligibilityFilters } from "../controllers/eligibilityFilters.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const eligibilityFiltersRoutes = Router();

eligibilityFiltersRoutes.get(
  "/eligibility-filters",
  asyncHandler(getEligibilityFilters),
);
