import type { EnrollmentForecast } from "../types.js";

// A site needs at least this many of its OWN completed trials with real
// enrollment data before we'll bootstrap a probability from them — below
// this, a "distribution" is really just 0-1 numbers, not a genuine spread.
// Below this bar the probability is honestly withheld ("insufficient-data")
// rather than borrowed from a broader, less-specific distribution (e.g. the
// indication-wide benchmark) — see the product conversation this feature
// came out of: a number that isn't really about THIS site is worse than no
// number at all.
const MIN_HISTORY_TRIALS_FOR_PROBABILITY = 2;

// Bootstrap sample size — large enough for a stable percentage, cheap enough
// to run per site on every ranking request.
const BOOTSTRAP_ITERATIONS = 5000;

export interface BuildEnrollmentForecastParams {
  /** pts/month — real (from this facility's own ClinicalTrials.gov history) or an LLM estimate. null/0 = no rate available at all, no forecast possible. */
  rate: number | null;
  /** Whether `rate` is real (liveKpiFields includes "Historical Enrollment Rate (pts/month)") or an LLM guess. */
  rateIsReal: boolean;
  targetSampleSize: number | null;
  durationMonths: number | null;
  /** This site's own real per-trial enrollment rates (see liveCandidateSites.ts's computeRealEnrollmentRates) — the ONLY source ever used for the probability estimate. */
  ownHistoricalRates: number[];
}

/**
 * Builds one site's Enrollment Forecast: a real-arithmetic projection of
 * expected enrollment and time-to-target from its own rate, plus — only when
 * genuinely supported by that site's own real historical data — a bootstrap-
 * resampled probability of hitting the target within the trial's planned
 * duration.
 *
 * The projection (expectedEnrollment, estimatedMonthsToTarget) is nothing
 * more than target/duration arithmetic on `rate` — it carries exactly as
 * much certainty as `rate` itself does (flagged via rateSource, same real-
 * vs-estimated distinction already used elsewhere in this app).
 *
 * The probability is a genuinely different kind of claim: it requires an
 * actual spread of possible outcomes, not just one point estimate. Rather
 * than assume a theoretical distribution shape (e.g. Poisson) around the
 * rate, this resamples with replacement from the site's OWN real historical
 * per-trial rates — real data, not an invented variance. Returns
 * probability: null (probabilityBasis: "insufficient-data") when the site
 * has fewer than MIN_HISTORY_TRIALS_FOR_PROBABILITY of its own real
 * completed trials to draw from, rather than falling back to a broader
 * indication-wide distribution that wouldn't actually be specific to this
 * site.
 */
export function buildEnrollmentForecast(
  params: BuildEnrollmentForecastParams,
): EnrollmentForecast | null {
  const { rate, rateIsReal, targetSampleSize, durationMonths, ownHistoricalRates } =
    params;

  if (
    rate === null ||
    rate <= 0 ||
    targetSampleSize === null ||
    targetSampleSize <= 0 ||
    durationMonths === null ||
    durationMonths <= 0
  ) {
    return null;
  }

  const expectedEnrollment = Math.round(rate * durationMonths);
  const estimatedMonthsToTarget = Math.round((targetSampleSize / rate) * 10) / 10;

  let probability: number | null = null;
  let probabilityBasis: EnrollmentForecast["probabilityBasis"] = "insufficient-data";

  if (ownHistoricalRates.length >= MIN_HISTORY_TRIALS_FOR_PROBABILITY) {
    let successes = 0;
    for (let i = 0; i < BOOTSTRAP_ITERATIONS; i++) {
      const draw =
        ownHistoricalRates[Math.floor(Math.random() * ownHistoricalRates.length)];
      if (draw * durationMonths >= targetSampleSize) successes++;
    }
    probability = Math.round((successes / BOOTSTRAP_ITERATIONS) * 100);
    probabilityBasis = "site-history";
  }

  return {
    targetSampleSize,
    durationMonths,
    rate: Math.round(rate * 10) / 10,
    rateSource: rateIsReal ? "real" : "llm-estimated",
    expectedEnrollment,
    estimatedMonthsToTarget,
    probability,
    probabilityBasis,
  };
}
