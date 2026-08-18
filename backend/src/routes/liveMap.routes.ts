import { Router } from "express";
import { getLiveSiteMap } from "../controllers/liveMap.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const liveMapRoutes = Router();

liveMapRoutes.get("/live-map", asyncHandler(getLiveSiteMap));
