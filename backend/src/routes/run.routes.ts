import { Router } from "express";
import { postRun } from "../controllers/run.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const runRoutes = Router();

runRoutes.post("/run", asyncHandler(postRun));
