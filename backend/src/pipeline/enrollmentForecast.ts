import type { EnrollmentForecast } from "../types.js";

const MIN_HISTORY_TRIALS_FOR_PROBABILITY = 2;
const BOOTSTRAP_ITERATIONS = 5000;

export interface BuildEnrollmentForecastParams {
  rate: number | null;
  /** Whether `rate` is real (liveKpiFields includes "Historical Enrollment Rate (pts/month)") or an LLM guess. */
  rateIsReal: boolean;
  targetSampleSize: number | null;
  durationMonths: number | null;
  /** This site's own real per-trial enrollment rates (see liveCandidateSites.ts's computeRealEnrollmentRates) — the ONLY source ever used for the probability estimate. */
  ownHistoricalRates: number[];
}

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
