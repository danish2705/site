import { Router } from "express";
import { getNctLookup } from "../controllers/nctLookup.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const nctLookupRoutes = Router();

nctLookupRoutes.get("/nct-lookup/:nctId", asyncHandler(getNctLookup));
