import type { Request, Response } from "express";
import { INDICATION_TO_SPECIALTY } from "../repository/excelStore.js";
import { getFieldTopValues } from "../services/ctgov.client.js";
import { REGION_DEFINITIONS } from "../data/regionMap.js";

const FALLBACK_INDICATIONS = Object.keys(INDICATION_TO_SPECIALTY);

export async function getMeta(_req: Request, res: Response): Promise<void> {
  let liveConditions: { value: string; count: number }[] = [];
  let liveCountries: { value: string; count: number }[] = [];
  let metaWarning: string | undefined;
  try {
    const fieldValues = await getFieldTopValues(["Condition", "LocationCountry"]);
    liveConditions = fieldValues.Condition ?? [];
    liveCountries = fieldValues.LocationCountry ?? [];
  } catch {
  }

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
    specialties: INDICATION_TO_SPECIALTY,
    liveConditions,
    liveCountries,
  });
}
