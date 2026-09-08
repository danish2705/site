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

  // Rare Disease feature — Orphanet/Orphadata integration.
  // api.orphadata.com's rd-cross-referencing / rd-epidemiology /
  // rd-natural_history endpoints are genuinely open (CC BY 4.0, no API key
  // or registration — verified directly against the live API), so there is
  // no key/config gate here, unlike this app's LLM or Google Maps
  // integrations. See services/orphadata.client.ts.
  rareDisease: {
    timeoutMs: Number(process.env.ORPHADATA_TIMEOUT_MS) || 8000,
    searchCacheTtlMs: Number(process.env.ORPHADATA_SEARCH_CACHE_TTL_MS) || 60 * 60 * 1000,
    // TTL for the full ~11,600-disease name/ORPHAcode index used to power
    // local search-as-you-type (see getDiseaseIndex) — one bulk fetch,
    // refreshed on this schedule, rather than a live call per keystroke.
    bulkFileCacheTtlMs:
      Number(process.env.ORPHADATA_BULK_CACHE_TTL_MS) || 24 * 60 * 60 * 1000,
  },

  // Real population denominators — WorldPop Global Project
  // (api.worldpop.org/v1/services/stats, "wpgppop" dataset). Genuinely open:
  // no API key required for normal use (an optional key only raises rate
  // limits for very large/bulk queries — see services/worldpop.client.ts).
  // Replaces the per-site "populationInRadius" number that previously came
  // entirely from data/syntheticPopulation.ts's seeded-random dataset.
  worldPop: {
    apiKey: optional("WORLDPOP_API_KEY"),
    // WorldPop's "Global per country 2000-2020" dataset only covers up to
    // 2020 — that's the most recent year available, not a stale default.
    datasetYear: Number(process.env.WORLDPOP_DATASET_YEAR) || 2020,
    // Per-attempt timeout for a synchronous (runasync=false) stats query.
    // WorldPop itself caps synchronous execution at 30s and auto-falls back
    // to an async task id past that, so this stays just under that ceiling.
    timeoutMs: Number(process.env.WORLDPOP_TIMEOUT_MS) || 28000,
    // If a query is too large to finish synchronously, WorldPop returns a
    // taskid to poll instead — these control that polling loop.
    pollIntervalMs: Number(process.env.WORLDPOP_POLL_INTERVAL_MS) || 2000,
    maxPollAttempts: Number(process.env.WORLDPOP_MAX_POLL_ATTEMPTS) || 10,
    cacheTtlMs:
      Number(process.env.WORLDPOP_CACHE_TTL_MS) || 30 * 24 * 60 * 60 * 1000,
  },
} as const;
