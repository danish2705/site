import { Router } from "express";
import { postPredictRegion } from "../controllers/region.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const regionRoutes = Router();

regionRoutes.post("/predict-region", asyncHandler(postPredictRegion));
