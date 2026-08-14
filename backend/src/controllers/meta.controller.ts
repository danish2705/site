import type { Request, Response } from "express";
import { INDICATION_TO_SPECIALTY } from "../repository/excelStore.js";
import { getFieldTopValues } from "../services/ctgov.client.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";

// Last-resort dropdown options if the live ClinicalTrials.gov vocabulary
// lookup returns nothing (network/TLS outage, ctgov disabled, etc.) — this
// is NOT live data and is never presented as such; it exists only so the
// app has something selectable instead of a dead-empty dropdown. It is the
// same static list as the old Excel INDICATION_TO_SPECIALTY keys, reused
// here purely as a UI safety net, not as a data source for scoring.
const FALLBACK_INDICATIONS = Object.keys(INDICATION_TO_SPECIALTY);

export async function getMeta(_req: Request, res: Response): Promise<void> {
  // Best-effort, additive live vocabulary from ClinicalTrials.gov. Falls
  // back to empty arrays (never throws) so a live-data outage never breaks
  // the core /api/meta response the whole app boots from.
  let liveConditions: { value: string; count: number }[] = [];
  let liveCountries: { value: string; count: number }[] = [];
  let metaWarning: string | undefined;
  try {
    const fieldValues = await getFieldTopValues(["Condition", "LocationCountry"]);
    liveConditions = fieldValues.Condition ?? [];
    liveCountries = fieldValues.LocationCountry ?? [];
  } catch {
    // already logged inside getFieldTopValues; nothing more to do here.
  }

  // `indications` normally comes straight from the live ClinicalTrials.gov
  // condition vocabulary. If that call came back empty (outage, TLS/proxy
  // issue, ctgov disabled), fall back to a small static list so the
  // dropdown is never fully empty — this is flagged via
  // `indicationsSource`/`metaWarning`, not silently presented as live.
  const indicationsSource: "live" | "fallback" =
    liveConditions.length > 0 ? "live" : "fallback";
  const indications =
    liveConditions.length > 0
      ? liveConditions.map((c) => c.value)
      : FALLBACK_INDICATIONS;
  if (indicationsSource === "fallback") {
    metaWarning =
      "Live ClinicalTrials.gov condition lookup returned no data (check backend logs for a [ctgov] warning — often a network/TLS proxy issue) — showing a static fallback indication list instead. Region/candidate-site/KPI data for these indications is still fetched live once you pick one; only this dropdown's source is not live right now.";
  }

  // `regions`/`regionOptions` now come from the code-level region/country
  // taxonomy (data/regionMap.ts) instead of Region_Data — every region now
  // applies to every indication, so `indication` is a wildcard "*" rather
  // than a real filter key (the old RegionOption shape kept only for
  // frontend compatibility).
  const regions = [...new Set(REGION_DEFINITIONS.map((def) => def.region))];
  const regionOptions = REGION_DEFINITIONS.map((def) => ({
    indication: "*",
    region: def.region,
    country: def.country,
  }));

  res.json({
    indications,
    indicationsSource,
    metaWarning,
    regions,
    regionOptions,
    // INDICATION_TO_SPECIALTY is kept as a static fast-path default map — at
    // runtime, pipeline/liveIndications.ts's resolveSpecialty() is the
    // actual source of truth: it checks this map first, then falls back to
    // an LLM inference for indications outside of it.
    specialties: INDICATION_TO_SPECIALTY,
    // Supplementary — the live, ranked condition/country vocabulary from
    // ClinicalTrials.gov. `indications` above is derived from
    // `liveConditions` when available (else the fallback list above), so
    // the two may briefly disagree during an outage — `indicationsSource`
    // tells you which case you're in.
    liveConditions,
    liveCountries,
  });
}
