import type { MapSiteRow } from "../types";

/**
 * Formatting/labeling helpers shared between the Site Map (Global) page's
 * map popups and the Site Map Details page's table — moved verbatim out of
 * the old single-file SiteMapView.tsx so both pages can use the exact same
 * labels/CSV export without duplicating logic.
 */

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function coordsSourceLabel(source: MapSiteRow["coordsSource"]): string {
  if (source === "approximate") return "approximate";
  if (source === "live-nominatim") return "geocoded (OpenStreetMap)";
  return "geocoded (Google)";
}

export function catchmentDistanceLabel(
  source: MapSiteRow["catchmentDistanceSource"],
): string {
  switch (source) {
    case "live-google":
      return "real driving distance (Google)";
    case "live-osrm":
      return "real driving distance (OSRM)";
    case "mixed":
      return "mix of real driving distance and straight-line";
    case "approximate-haversine":
      return "straight-line distance (no driving-distance data)";
    default:
      return "n/a";
  }
}

export function segmentsLine(s: MapSiteRow): string {
  if (!s.patientSegments) return "";
  const seg = s.patientSegments;
  return (
    `Newly diagnosed: ${seg.newlyDiagnosed.toLocaleString()} · ` +
    `Non-responder: ${seg.nonResponder.toLocaleString()} · ` +
    `Stable: ${seg.stableOnTreatment.toLocaleString()} (illustrative split)`
  );
}

// Derives the badge color band directly from the numeric score, instead of
// trusting the LLM's separately-estimated riskLevel label — the model
// doesn't enforce a strict number-to-label mapping, so two sites can get
// the identical score with different labels (e.g. two "35/100" sites, one
// tagged Low and the other Medium). This guarantees the same number always
// renders the same color. Used by both the map popups and the Details table.
export function riskBand(
  score: number | null,
): "low" | "medium" | "high" | "unknown" {
  if (score === null) return "unknown";
  if (score < 34) return "low";
  if (score < 67) return "medium";
  return "high";
}

export type SortKey = "site" | "location" | "gross" | "net" | "risk";

function escapeCsvValue(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function sitesToCsv(sites: MapSiteRow[]): string {
  const header = [
    "Site",
    "City",
    "State",
    "Country",
    "Gross Eligible Patients",
    "Already Enrolled Patients",
    "Net Available Patients",
    "Assumed Consent/Conversion Rate (%)",
    "Expected Recruitment",
    "Newly Diagnosed (illustrative)",
    "Non-Responder (illustrative)",
    "Stable On Treatment (illustrative)",
    "Risk Level",
    "Risk Score",
    "Coordinates Source",
    "Catchment Distance Source",
  ];
  const rows = sites.map((s) => [
    s.siteName,
    s.city ?? "",
    s.state ?? "",
    s.country ?? "",
    s.grossEligiblePatients,
    s.alreadyEnrolledPatients,
    s.netAvailablePatients,
    Math.round(s.assumedConsentRate * 1000) / 10,
    Math.round(s.netAvailablePatients * s.assumedConsentRate),
    s.patientSegments?.newlyDiagnosed ?? "",
    s.patientSegments?.nonResponder ?? "",
    s.patientSegments?.stableOnTreatment ?? "",
    s.riskLevel,
    s.riskScore ?? "",
    s.coordsSource,
    s.catchmentDistanceSource,
  ]);
  return [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Fixed values — previously user-adjustable controls, kept as constants now that those controls are removed from the UI (see original SiteMapView.tsx). */
export const SITE_MAP_RADIUS_MILES = 50;
export const SITE_MAP_METRIC: "gross" | "net" = "net";
export const MILES_TO_METERS = 1609.34;
