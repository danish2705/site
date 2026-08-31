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
    // Not live, not synthetic — a single, uniformly-applied, stated
    // assumption (Srikanth's own example figure from the walkthrough: "you
    // have 200 patients, you can only recruit 20 patients... apply the
    // 10%"). No public source discloses what fraction of a site's
    // already-net-of-competing-enrollment eligible patients actually
    // consent to enroll in THIS specific trial once approached, so this is
    // a declared, adjustable constant rather than a fabricated per-site
    // number. Applied on top of (not instead of) the existing
    // netAvailablePatients figure, which already nets out an estimated
    // already-enrolled-elsewhere share — this haircut is a second, distinct
    // step: of the patients left after that, how many will actually say yes.
    assumedConsentRate:
      Number(process.env.SITE_COMBO_ASSUMED_CONSENT_RATE) || 0.1,
  },

  competingTrials: {
    // Which ClinicalTrials.gov OverallStatus values count as an "ongoing /
    // competing" trial for the same indication (feeds
    // RegionRow["Active Competing Trials"] via
    // services/ctgov.client.ts's getActiveCompetingTrialsCount). This is a
    // business definition of "live/competing trial," not a fixed
    // ClinicalTrials.gov constant — Srikanth's requirement was explicit that
    // it "shouldn't only look for one status such as Active" and that the
    // exact statuses used should be configurable. Adjustable via a
    // comma-separated env var (e.g. "RECRUITING,ACTIVE_NOT_RECRUITING")
    // rather than hardcoded in the query-building code. Terminal statuses
    // (COMPLETED, TERMINATED, WITHDRAWN, SUSPENDED) are deliberately absent
    // from the default — a trial that has stopped is no longer active
    // competition for the same patients.
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
    // Heuristic thresholds, not a published standard — flags a facility as
    // potentially overloaded once it is concurrently running this many
    // active/recruiting trials (any indication), per Srikanth's "there's an
    // upper limit on how many trials they can support... you don't want to
    // hit the true limit because their quality will go down" point. Counted
    // from the facility's own live, disclosed trial-status history
    // (LocationStatus across every trial on file for it) — the threshold
    // values themselves are just a stated convention, adjustable via env.
    highThreshold: Number(process.env.SITE_WORKLOAD_HIGH_THRESHOLD) || 8,
    mediumThreshold: Number(process.env.SITE_WORKLOAD_MEDIUM_THRESHOLD) || 4,
  },
} as const;
