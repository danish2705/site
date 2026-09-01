import { Router } from "express";
import { searchIndications } from "../controllers/indicationSearch.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const indicationSearchRoutes = Router();

indicationSearchRoutes.get("/indication-search", asyncHandler(searchIndications));
