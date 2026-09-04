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

/**
 * Builds a self-contained, printable HTML report for the final recommended
 * site — redesign spec item 20 ("Add a Polished Final 'Next Steps'") calls
 * for a working "Download Report" action on the completion screen. No
 * backend report-generation endpoint exists yet, so this composes the
 * report from data the page already has (FinalResult + the trial form) and
 * downloads it client-side; opening the file and printing to PDF from the
 * browser produces a shareable PDF without a server round-trip.
 */
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

/**
 * Triggers a browser download of the report as a standalone .html file
 * (openable in any browser and printable to PDF from there).
 */
export function downloadFinalRecommendationReport(
  site: FinalResult,
  form: TrialForm,
  why: WhyNumberOne,
): void {
  const html = buildFinalRecommendationReportHtml(site, form, why);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const safeName = site.recommendedSite
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `site-selection-report-${safeName || "recommendation"}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
