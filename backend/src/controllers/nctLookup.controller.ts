import type { Request, Response } from "express";
import { getStudyByNctId, studyAgeGroups } from "../services/ctgov.client.js";
import { badRequest, notFoundError } from "../utils/httpError.js";
import type { NctLookupResponse } from "../types.js";

// ClinicalTrials.gov's own PHASE1-4 values (plus EARLY_PHASE1) mapped onto
// this app's Sidebar PHASES labels. A study can disclose more than one phase
// (e.g. a combined Phase II/III trial) — this app's form only supports a
// single discrete Phase, so the most ADVANCED phase present is used as the
// best single-value stand-in rather than leaving the field blank.
const PHASE_RANK: Record<string, number> = {
  EARLY_PHASE1: 1,
  PHASE1: 1,
  PHASE2: 2,
  PHASE3: 3,
  PHASE4: 4,
};
const PHASE_LABEL: Record<number, string> = {
  1: "Phase I",
  2: "Phase II",
  3: "Phase III",
  4: "Phase IV",
};

function mapPhase(phases: string[]): string | null {
  const ranks = phases
    .map((p) => PHASE_RANK[p.toUpperCase()])
    .filter((n): n is number => typeof n === "number");
  if (ranks.length === 0) return null;
  return PHASE_LABEL[Math.max(...ranks)] ?? null;
}

const STD_AGE_LABEL: Record<string, string> = {
  CHILD: "Child (0–17)",
  ADULT: "Adult (18–64)",
  OLDER_ADULT: "Older Adult (65+)",
};

function mapAgeGroups(
  minimumAge: string | null,
  maximumAge: string | null,
): string[] {
  const groups = studyAgeGroups(minimumAge, maximumAge);
  return [...groups]
    .map((g) => STD_AGE_LABEL[g])
    .filter((label): label is string => !!label);
}

function monthsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return months > 0 ? months : null;
}

// Loose sanity check only — the real validation is ClinicalTrials.gov itself
// 404ing anything it doesn't recognize. This just avoids sending an obviously
// empty/garbage id to the live API and gives a clearer 400 instead.
const NCT_ID_PATTERN = /^NCT\d{6,9}$/i;

/**
 * GET /api/nct-lookup/:nctId
 *
 * Landing page's "Search by NCT Number" — looks up one real, disclosed
 * ClinicalTrials.gov study and normalizes it onto this app's own TrialForm
 * field values (Indication, Phase, Age Group, Target Enrollment, Duration),
 * so the frontend can auto-fill and run the analysis with zero manual form
 * interaction. Region/Country is deliberately NOT derived from the trial's
 * own disclosed sites — see NctLookupResponse.countries.
 */
export async function getNctLookup(req: Request, res: Response): Promise<void> {
  const nctId = String(req.params.nctId || "").trim();
  if (!nctId) {
    throw badRequest("An NCT number is required.");
  }
  if (!NCT_ID_PATTERN.test(nctId)) {
    throw badRequest(
      `"${nctId}" doesn't look like a valid NCT number (expected e.g. NCT01234567).`,
    );
  }

  const study = await getStudyByNctId(nctId);
  if (!study) {
    throw notFoundError(
      `No study found on ClinicalTrials.gov for "${nctId}". Double-check the NCT number, or use "Enter Study Details Manually" instead.`,
    );
  }

  const response: NctLookupResponse = {
    nctId: study.nctId,
    briefTitle: study.briefTitle,
    officialTitle: study.officialTitle,
    indication: study.condition,
    overallStatus: study.overallStatus,
    phase: mapPhase(study.phases),
    ageGroups: mapAgeGroups(study.minimumAge, study.maximumAge),
    enrollmentCount: study.enrollmentCount,
    enrollmentType: study.enrollmentType,
    durationMonths: monthsBetween(study.startDate, study.primaryCompletionDate),
    countries: study.countries,
    siteCount: study.siteCount,
    facilities: study.facilities,
  };

  res.json(response);
}
