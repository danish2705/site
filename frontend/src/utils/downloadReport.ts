import type { FinalResult, TrialForm } from "../types";
import type { WhyNumberOne } from "./whyNumberOne";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function componentRow(label: string, value: number | null): string {
  if (value === null || value === undefined) {
    return `<tr><td>${label}</td><td>No data</td></tr>`;
  }
  return `<tr><td>${label}</td><td>${value.toFixed(0)}/100</td></tr>`;
}

export function buildFinalRecommendationReportHtml(
  site: FinalResult,
  form: TrialForm,
  why: WhyNumberOne,
): string {
  const generatedAt = new Date().toLocaleString();
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Site Selection Report — ${escapeHtml(site.recommendedSite)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a2e; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
  h1 { font-size: 22px; margin-bottom: 2px; }
  h2 { font-size: 15px; margin-top: 32px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  .subtitle { color: #666; font-size: 13px; margin-top: 0; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .badge.high { background: #fde2e2; color: #b91c1c; }
  .badge.medium { background: #fef3c7; color: #92400e; }
  .badge.low { background: #dcfce7; color: #15803d; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 13px; }
  ul { margin: 6px 0; padding-left: 20px; }
  li { font-size: 13px; margin-bottom: 4px; }
  .score { font-size: 32px; font-weight: 800; }
  .footer { margin-top: 40px; font-size: 11px; color: #999; }
  @media print { body { margin: 0; padding: 16px; } }
</style>
</head>
<body>
  <h1>Clinical Trial Site Selection — Recommendation Report</h1>
  <p class="subtitle">Indication: ${escapeHtml(form.indication || "—")}${form.phase ? " · Phase " + escapeHtml(form.phase) : ""} · Generated ${escapeHtml(generatedAt)}</p>

  <h2>Recommended Site</h2>
  <p><strong>${escapeHtml(site.recommendedSite)}</strong><br/>${escapeHtml(site.region)}, ${escapeHtml(site.country)}</p>
  <p>
    <span class="score">${site.score}</span>/100 &nbsp;
    <span class="badge ${site.confidence === "High" ? "low" : site.confidence === "Medium" ? "medium" : "high"}">${escapeHtml(site.confidence)} confidence</span>
    &nbsp;
    <span class="badge ${site.riskLevel === "Low" ? "low" : site.riskLevel === "Medium" ? "medium" : "high"}">${escapeHtml(site.riskLevel)} risk</span>
  </p>
  <p>Estimated patient population: ${site.estimatedPatients?.toLocaleString() ?? "—"}</p>

  <h2>Score Breakdown</h2>
  <table>
    <tbody>
      ${componentRow("Recruitment", site.components.recruitment)}
      ${componentRow("Quality", site.components.quality)}
      ${componentRow("Retention", site.components.retention)}
      ${componentRow("Diversity", site.components.diversity)}
      ${componentRow("Cost efficiency", site.components.cost)}
    </tbody>
  </table>

  <h2>Strengths</h2>
  <ul>${why.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>

  <h2>Watch-outs</h2>
  ${why.watchOuts.length > 0 ? `<ul>${why.watchOuts.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>` : "<p>No material watch-outs identified.</p>"}

  <h2>AI Conclusion</h2>
  <p>${escapeHtml(why.conclusion)}</p>

  <p class="footer">This report was generated from the Clinical Trial Site Selection application and reflects the analysis parameters selected at generation time. Some figures may be AI-estimated where live data was unavailable.</p>
</body>
</html>`;
}

function safeFileSlug(site: FinalResult): string {
  return (
    site.recommendedSite
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "recommendation"
  );
}

export function downloadFinalRecommendationReportPdf(
  site: FinalResult,
  form: TrialForm,
  why: WhyNumberOne,
): void {
  const html = buildFinalRecommendationReportHtml(site, form, why);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.alert(
      "Your browser blocked the print/PDF window. Please allow pop-ups for this site and try again.",
    );
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    printWindow.focus();
    printWindow.print();
  };
  printWindow.onload = doPrint;
  setTimeout(doPrint, 400);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map((c) => csvEscape(c === null || c === undefined ? "" : String(c))).join(",") + "\r\n";
}

function componentCsvValue(value: number | null): string {
  return value === null || value === undefined ? "No data" : `${value.toFixed(0)}/100`;
}

export function buildFinalRecommendationReportCsv(
  site: FinalResult,
  form: TrialForm,
  why: WhyNumberOne,
): string {
  const generatedAt = new Date().toLocaleString();
  let csv = "";
  csv += csvRow("Clinical Trial Site Selection — Recommendation Report");
  csv += csvRow("Indication", form.indication || "—");
  csv += csvRow("Phase", form.phase || "—");
  csv += csvRow("Generated", generatedAt);
  csv += csvRow();

  csv += csvRow("Recommended Site", site.recommendedSite);
  csv += csvRow("Region", site.region);
  csv += csvRow("Country", site.country);
  csv += csvRow("Score", `${site.score}/100`);
  csv += csvRow("Confidence", site.confidence);
  csv += csvRow("Risk Level", site.riskLevel);
  csv += csvRow("Estimated Patients", site.estimatedPatients?.toLocaleString() ?? "—");
  csv += csvRow();

  csv += csvRow("Score Breakdown");
  csv += csvRow("Component", "Score");
  csv += csvRow("Recruitment", componentCsvValue(site.components.recruitment));
  csv += csvRow("Quality", componentCsvValue(site.components.quality));
  csv += csvRow("Retention", componentCsvValue(site.components.retention));
  csv += csvRow("Diversity", componentCsvValue(site.components.diversity));
  csv += csvRow("Cost efficiency", componentCsvValue(site.components.cost));
  csv += csvRow();

  csv += csvRow("Strengths");
  why.strengths.forEach((s) => (csv += csvRow(s)));
  csv += csvRow();

  csv += csvRow("Watch-outs");
  if (why.watchOuts.length > 0) {
    why.watchOuts.forEach((w) => (csv += csvRow(w)));
  } else {
    csv += csvRow("No material watch-outs identified.");
  }
  csv += csvRow();

  csv += csvRow("AI Conclusion");
  csv += csvRow(why.conclusion);

  return csv;
}

export function downloadFinalRecommendationReportExcel(
  site: FinalResult,
  form: TrialForm,
  why: WhyNumberOne,
): void {
  const csv = buildFinalRecommendationReportCsv(site, form, why);
  // Leading BOM so Excel opens the UTF-8 file with accented/special
  // characters intact instead of guessing the wrong encoding.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `site-selection-report-${safeFileSlug(site)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
