import type { Request, Response } from "express";
import {
  searchRareDiseasesByName,
  getRareDiseaseNomenclature,
  getRareDiseaseEpidemiology,
  getRareDiseaseNaturalHistory,
} from "../services/orphadata.client.js";
import { getFacilitiesForCondition } from "../services/ctgov.client.js";
import { badRequest, notFoundError } from "../utils/httpError.js";
import type { RareDiseaseDetail, RareDiseaseTrialSite } from "../types.js";

const TRIAL_SITE_PAGE_SIZE = 30;

/**
 * GET /api/rare-disease/status
 * api.orphadata.com's rd-cross-referencing / rd-epidemiology /
 * rd-natural_history endpoints are open (no API key), so this is always
 * available — kept as an endpoint mainly so the frontend has something to
 * probe on load rather than assuming.
 */
export function getRareDiseaseStatus(_req: Request, res: Response): void {
  res.json({ available: true, source: "https://api.orphadata.com (no key required)" });
}

/**
 * GET /api/rare-disease/search?q=...
 * Live, real disease-name search over Orphanet's own full nomenclature list
 * (fetched once, cached — see orphadata.client.ts's getDiseaseIndex) —
 * backs the Rare Disease box's search-as-you-type dropdown.
 */
export async function searchRareDiseases(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  const results = q.length >= 2 ? await searchRareDiseasesByName(q) : [];
  res.json({ query: q, results });
}

/**
 * GET /api/rare-disease/:orphaCode
 * Assembles the single live-data page: real Orphanet nomenclature +
 * epidemiology + natural history, plus a real ClinicalTrials.gov cross-check
 * for whether any trials/sites currently exist for this disease. Every field
 * here is real, disclosed data — nothing LLM-estimated — so a section with
 * nothing to show renders empty with a warning rather than being backfilled
 * with a guess.
 */
export async function getRareDiseaseDetail(req: Request, res: Response): Promise<void> {
  const orphaCode = String(req.params.orphaCode || "").trim();
  if (!orphaCode || !/^\d+$/.test(orphaCode)) {
    throw badRequest(`"${orphaCode}" doesn't look like a valid ORPHAcode (expected a number).`);
  }

  const [nomenclature, prevalence, naturalHistory] = await Promise.all([
    getRareDiseaseNomenclature(orphaCode),
    getRareDiseaseEpidemiology(orphaCode),
    getRareDiseaseNaturalHistory(orphaCode),
  ]);

  if (!nomenclature) {
    throw notFoundError(`No Orphanet record found for ORPHAcode ${orphaCode}.`);
  }

  const warnings: string[] = [];
  if (prevalence.length === 0) {
    warnings.push(
      "No epidemiology (prevalence/incidence) record published by Orphanet for this disease.",
    );
  }
  if (naturalHistory.averageAgeOfOnset.length === 0 && naturalHistory.typeOfInheritance.length === 0) {
    warnings.push(
      "No natural history (inheritance / average age of onset) record published by Orphanet for this disease.",
    );
  }

  let trialSites: RareDiseaseTrialSite[] = [];
  const searchNames = [nomenclature.name, ...nomenclature.synonyms].filter(Boolean);
  for (const name of searchNames) {
    if (trialSites.length > 0) break; // first name with any real hits wins — avoids double-counting the same trials under a synonym
    try {
      const facilities = await getFacilitiesForCondition(name, {
        pageSize: TRIAL_SITE_PAGE_SIZE,
      });
      trialSites = facilities.map((f) => ({
        nctId: f.nctId,
        briefTitle: f.briefTitle,
        facility: f.facility,
        city: f.city,
        state: f.state,
        country: f.country,
        status: f.status,
      }));
    } catch {
      // getFacilitiesForCondition already warns internally and returns [] on
      // failure — nothing extra to do here, just try the next synonym.
    }
  }
  if (trialSites.length === 0) {
    warnings.push(
      "No ClinicalTrials.gov trials found for this disease's Orphanet name or synonyms — this is expected for many ultra-rare diseases.",
    );
  }

  const response: RareDiseaseDetail = {
    orphaCode: nomenclature.orphaCode,
    name: nomenclature.name,
    definition: nomenclature.definition,
    typology: nomenclature.typology,
    synonyms: nomenclature.synonyms,
    crossReferences: nomenclature.crossReferences,
    inheritance: naturalHistory.typeOfInheritance,
    averageAgeOfOnset: naturalHistory.averageAgeOfOnset,
    averageAgeOfDeath: naturalHistory.averageAgeOfDeath,
    prevalence,
    trialSites,
    warnings,
    sources: {
      nomenclature: "Orphanet Rare diseases and cross-referencing (api.orphadata.com, CC BY 4.0)",
      epidemiology: "Orphanet Epidemiology of rare diseases (api.orphadata.com, CC BY 4.0)",
      naturalHistory: "Orphanet Natural history of rare diseases (api.orphadata.com, CC BY 4.0)",
      trials: "ClinicalTrials.gov",
    },
  };

  res.json(response);
}
