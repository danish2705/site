import type { Request, Response } from "express";
import { runSiteAnalysis } from "../pipeline/runPipeline.js";
import { buildLiveTrialRequirement } from "../pipeline/liveRequirements.js";
import { buildLiveRegionRow } from "../pipeline/liveRegionMetrics.js";
import { resolveSpecialty } from "../pipeline/liveIndications.js";
import { badRequest } from "../utils/httpError.js";
import type { LiveFacility } from "../services/ctgov.client.js";
import type { PipelineInput } from "../types.js";

function toPositiveNumberOrUndefined(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseFacilities(raw: unknown): LiveFacility[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw badRequest('Body field "facilities" must be a non-empty array.');
  }
  // ClinicalTrials.gov records legitimately omit the facility/site name for
  // some trials (sponsor never filled it in). A single such row used to
  // fail the ENTIRE batch with a 400 — which is why picking a second
  // country from the Risk Register dropdown (a country whose live data
  // happens to include one of these blank-name rows) could 400 while the
  // default country (whose data didn't) worked fine. Skip unusable rows
  // instead of rejecting the whole request; only 400 if nothing usable is
  // left.
  const parsed = raw
    .map((f: unknown): LiveFacility | null => {
      const facility = f as Record<string, unknown>;
      if (typeof facility.facility !== "string" || !facility.facility) {
        return null;
      }
      return {
        nctId: typeof facility.nctId === "string" ? facility.nctId : "",
        briefTitle:
          typeof facility.briefTitle === "string" ? facility.briefTitle : null,
        facility: facility.facility,
        city: typeof facility.city === "string" ? facility.city : null,
        state: typeof facility.state === "string" ? facility.state : null,
        country:
          typeof facility.country === "string" ? facility.country : null,
        status: typeof facility.status === "string" ? facility.status : null,
        lastUpdatePostDate:
          typeof facility.lastUpdatePostDate === "string"
            ? facility.lastUpdatePostDate
            : null,
        minimumAge:
          typeof facility.minimumAge === "string" ? facility.minimumAge : null,
        maximumAge:
          typeof facility.maximumAge === "string" ? facility.maximumAge : null,
      };
    })
    .filter((f): f is LiveFacility => f !== null);

  if (parsed.length === 0) {
    throw badRequest(
      "None of the supplied facilities has a usable facility/site name.",
    );
  }
  return parsed;
}

/**
 * POST /api/site-analysis
 * Body: { indication, phase?, sampleSize?, durationMonths?, budgetTier?,
 *         ageGroups?, region, country, facilities: LiveFacility[] }
 *
 * Runs Stages 4-8 (Candidate Site Identification through Final
 * Recommendation) over EXACTLY the facilities the caller supplies — the
 * real ClinicalTrials.gov rows a user already reviewed on the Ongoing
 * Trials tab (GET /api/live-trials) — instead of Stage 4 silently
 * re-querying ClinicalTrials.gov on its own and potentially landing on a
 * different set of sites. `region`/`country` are the ones already resolved
 * by Stage 2 of a prior /api/run call (see PipelineContext's `topRegion`).
 *
 * `specialty` and the trial requirement/region-metrics figures are
 * re-derived here from indication/region/country rather than trusted from
 * the caller — same pattern as postSiteCombination in
 * siteCombination.controller.ts — which keeps the request body small and
 * reuses the same cached live calls Stages 1-3 already made.
 *
 * Streams the same SSE "stage" events as POST /api/run (stages 4-8 only).
 */
export async function postSiteAnalysis(
  req: Request,
  res: Response,
): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const indication =
    typeof body.indication === "string" ? body.indication.trim() : "";
  const region = typeof body.region === "string" ? body.region : "";
  const country = typeof body.country === "string" ? body.country : "";
  const ageGroups = Array.isArray(body.ageGroups)
    ? body.ageGroups.map((g) => String(g))
    : [];

  if (!indication) {
    throw badRequest('Body field "indication" is required.');
  }
  if (!country) {
    throw badRequest('Body field "country" is required.');
  }
  const facilities = parseFacilities(body.facilities);

  const specialty = await resolveSpecialty(indication);
  const sampleSize = toPositiveNumberOrUndefined(body.sampleSize);
  const durationMonths = toPositiveNumberOrUndefined(body.durationMonths);

  const [requirement, regionRow] = await Promise.all([
    buildLiveTrialRequirement({
      indication,
      specialty,
      phase: typeof body.phase === "string" ? body.phase : undefined,
      sampleSize,
      durationMonths,
      ageGroups,
    }),
    buildLiveRegionRow({
      region: region || "Global",
      country,
      indication,
      specialty,
    }),
  ]);

  const input: PipelineInput = {
    indication,
    phase: typeof body.phase === "string" ? body.phase : undefined,
    sampleSize,
    durationMonths,
    budgetTier: typeof body.budgetTier === "string" ? body.budgetTier : undefined,
    ageGroups,
  };

  const ASSUMED_CATCHMENT = 5_000_000;
  const estimatedPatients = Math.round(
    (regionRow["Prevalence (per 100k)"] / 100000) * ASSUMED_CATCHMENT,
  );

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runSiteAnalysis(
      {
        input,
        indication,
        specialty,
        requirement,
        topRegion: regionRow,
        estimatedPatients,
        ageGroups,
        facilities,
      },
      send,
    );
    send("done", {});
  } catch (err) {
    send("error", { message: (err as Error).message });
  }
  res.end();
}
