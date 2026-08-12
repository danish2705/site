import { Router } from "express";
import { getMeta } from "../controllers/meta.controller.js";

export const metaRoutes = Router();

metaRoutes.get("/meta", getMeta);
