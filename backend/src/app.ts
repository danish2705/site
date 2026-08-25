import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { healthRoutes } from "./routes/health.routes.js";
import { liveTrialsRoutes } from "./routes/liveTrials.routes.js";
import { liveMapRoutes } from "./routes/liveMap.routes.js";
import { metaRoutes } from "./routes/meta.routes.js";
import { regionRoutes } from "./routes/region.routes.js";
import { runRoutes } from "./routes/run.routes.js";
import { runsRoutes } from "./routes/runs.routes.js";
import { siteCombinationRoutes } from "./routes/siteCombination.routes.js";
import { siteAnalysisRoutes } from "./routes/siteAnalysis.routes.js";
import { siteRecommendationRoutes } from "./routes/siteRecommendation.routes.js";
import { eligibilityFiltersRoutes } from "./routes/eligibilityFilters.routes.js";

export function createApp() {
  const app = express();

  app.use(
    cors(
      config.corsOrigins.length > 0
        ? { origin: config.corsOrigins }
        : undefined,
    ),
  );

  app.use(express.json({ limit: "2mb" }));
  app.use("/api", healthRoutes);
  app.use("/api", metaRoutes);
  app.use("/api", regionRoutes);
  app.use("/api", runRoutes);
  app.use("/api", runsRoutes);
  app.use("/api", liveTrialsRoutes);
  app.use("/api", liveMapRoutes);
  app.use("/api", siteCombinationRoutes);
  app.use("/api", siteAnalysisRoutes);
  app.use("/api", siteRecommendationRoutes);
  app.use("/api", eligibilityFiltersRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
