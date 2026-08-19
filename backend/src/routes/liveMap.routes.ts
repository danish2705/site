import { Router } from "express";
import {
  getCombinedCatchment,
  getLiveSiteMap,
} from "../controllers/liveMap.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const liveMapRoutes = Router();

liveMapRoutes.get("/live-map", asyncHandler(getLiveSiteMap));
liveMapRoutes.post(
  "/live-map/combined-catchment",
  asyncHandler(getCombinedCatchment),
);
