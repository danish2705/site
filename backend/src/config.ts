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
    // Set CTGOV_ENABLED=false to fall back to the static Excel values only
    // (e.g. offline dev, or if clinicaltrials.gov is unreachable from your network).
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

    patientSegmentSplit: {
      newlyDiagnosed: Number(process.env.MAP_SEGMENT_NEWLY_DIAGNOSED) || 0.15,
      nonResponder: Number(process.env.MAP_SEGMENT_NON_RESPONDER) || 0.25,
      stableOnTreatment:
        Number(process.env.MAP_SEGMENT_STABLE_ON_TREATMENT) || 0.6,
    },

    // Straight-line (haversine) distance is always <= real driving distance,
    // so it's used as a cheap pre-filter before spending a real distance-API
    // call on a synthetic catchment point: only points within
    // radiusMiles * this factor are checked for real driving distance.
    // 1.4 is a stated, generous margin — real-world driving-to-straight-line
    // ratios are rarely above ~1.3x outside of extreme geography (rivers,
    // mountains with few crossings) — not a measured constant.
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
