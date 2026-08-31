import dotenv from "dotenv";

dotenv.config();

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigins: list("CORS_ORIGIN"),
  databaseUrl: optional("DATABASE_URL"),

  llm: {
    model:
      optional("AZURE_OPENAI_LLM_DEPLOYMENT") ??
      optional("OPENAI_MODEL") ??
      "gpt-4.1",
    azureEndpoint: optional("AZURE_OPENAI_ENDPOINT"),
    azureKey: optional("AZURE_OPENAI_API_KEY"),
    openaiKey: optional("OPENAI_API_KEY"),
  },

  ctgov: {
    enabled: optional("CTGOV_ENABLED") !== "false",
    timeoutMs: Number(process.env.CTGOV_TIMEOUT_MS) || 6000,
    cacheTtlMs: Number(process.env.CTGOV_CACHE_TTL_MS) || 6 * 60 * 60 * 1000,
    regionConcurrency: Number(process.env.PREDICT_REGION_CONCURRENCY) || 4,
    facilityConcurrency: Number(process.env.PREDICT_FACILITY_CONCURRENCY) || 6,
  },

  google: {
    mapsApiKey: optional("GOOGLE_MAPS_API_KEY"),
  },

  geo: {
    contactEmail: optional("GEO_CONTACT_EMAIL"),
  },

  map: {
    defaultRadiusMiles: Number(process.env.MAP_DEFAULT_RADIUS_MILES) || 50,

    baselineRecruitmentRate:
      Number(process.env.MAP_BASELINE_RECRUITMENT_RATE) || 0.225,
    addressableFraction: Number(process.env.MAP_ADDRESSABLE_FRACTION) || 0.02,

    // Illustrative baseline split of a site's net-available patients into
    // treatment-stage buckets (newly-diagnosed/treatment-naive, on-drug
    // non-responders, and already-stable patients) — NOT derived from real
    // claims/EHR data. No live source distinguishes these three groups per
    // site at this granularity; this fixed split exists only so the app can
    // show the shape of the breakdown Srikanth described (net-new and
    // non-responders are the realistic recruits; stable patients are not).
    // Replace with a real claims-data-driven segmentation once that source
    // is integrated.
    patientSegmentSplit: {
      newlyDiagnosed: Number(process.env.MAP_SEGMENT_NEWLY_DIAGNOSED) || 0.15,
      nonResponder: Number(process.env.MAP_SEGMENT_NON_RESPONDER) || 0.25,
      stableOnTreatment:
        Number(process.env.MAP_SEGMENT_STABLE_ON_TREATMENT) || 0.6,
    },

    catchmentPrefilterFactor:
      Number(process.env.MAP_CATCHMENT_PREFILTER_FACTOR) || 1.4,
  },

  siteCombination: {
    assumedConsentRate:
      Number(process.env.SITE_COMBO_ASSUMED_CONSENT_RATE) || 0.1,
  },

  competingTrials: {
    statuses:
      list("COMPETING_TRIAL_STATUSES").length > 0
        ? list("COMPETING_TRIAL_STATUSES")
        : [
            "RECRUITING",
            "NOT_YET_RECRUITING",
            "ACTIVE_NOT_RECRUITING",
            "ENROLLING_BY_INVITATION",
          ],
  },

  siteWorkload: {
    highThreshold: Number(process.env.SITE_WORKLOAD_HIGH_THRESHOLD) || 8,
    mediumThreshold: Number(process.env.SITE_WORKLOAD_MEDIUM_THRESHOLD) || 4,
  },
} as const;
