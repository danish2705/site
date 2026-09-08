import { Router } from "express";
import {
  getRareDiseaseStatus,
  searchRareDiseases,
  getRareDiseaseDetail,
} from "../controllers/rareDisease.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const rareDiseaseRoutes = Router();

rareDiseaseRoutes.get("/rare-disease/status", getRareDiseaseStatus);
rareDiseaseRoutes.get("/rare-disease/search", asyncHandler(searchRareDiseases));
rareDiseaseRoutes.get("/rare-disease/:orphaCode", asyncHandler(getRareDiseaseDetail));
