import ScoreBreakdown from "./ScoreBreakdown";
import { MailIcon, CheckIcon, XIcon, ChevronDownIcon } from "../ui/Icons";
import type { RankingRow } from "../../types";

/**
 * One site's card in the Ranking page's Cards view (redesign refresh) — the
 * #1 site renders this with `hero` for a larger, highlighted treatment, and
 * every other ranked site renders the same card at compact size in the grid
 * below it. Mirrors exactly what the existing Table view's row already
 * shows (score breakdown, protocol-fit checklist toggle, risk/status
 * badges, draft-email action) so nothing is lost by picking Cards over
 * Table — see SiteRankingPanel.tsx, which still renders the untouched
 * table for Table mode.
 */
export default function RankingSiteCard({
  row,
  hero = false,
  statusLabel,
  statusBand,
  expanded,
  onToggleExpand,
  draftLabel,
  draftLoading,
  onDraftClick,
}: {
  row: RankingRow;
  hero?: boolean;
  statusLabel: (status: string | null) => string;
  statusBand: (status: string | null) => "low" | "medium" | "high" | "info" | "no-data";
  expanded: boolean;
  onToggleExpand: () => void;
  draftLabel: string;
  draftLoading: boolean;
  onDraftClick: () => void;
}) {
  const metCount = row.requirementChecks.filter((c) => c.pass).length;
  const requirementsLabel = row.meetsRequirements
    ? "Meets all"
    : `${metCount}/${row.requirementChecks.length} met`;

  return (
    <div className={hero ? "ranking-hero-card" : "ranking-mini-card"}>
      <div className="ranking-card-top">
        <span className="ranking-rank-badge">#{row.rank}</span>
        <div className="ranking-card-identity">
          <div className="ranking-card-name" title={row.siteName}>
            {row.siteName}
          </div>
          <div className="ranking-card-region">{row.region}</div>
        </div>
        <div className="ranking-card-score">
          {row.score}
          <span className="ranking-card-score-max">/100</span>
          {row.confidence !== "High" && (
            <div className="score-confidence" data-tooltip={row.caveats.join(" ")}>
              {row.confidence.toLowerCase()} confidence
            </div>
          )}
        </div>
      </div>

      <div className="ranking-card-breakdown">
        <ScoreBreakdown
          components={row.components}
          liveKpiFields={row.liveKpiFields}
          liveKpiSourceNctId={row.liveKpiSourceNctId}
          raceBreakdown={row.raceBreakdown}
        />
      </div>

      <div className="ranking-card-badges">
        <span className={`badge ${row.riskLevel.toLowerCase()}`}>{row.riskLevel} Risk</span>
        <button
          type="button"
          className={`protocol-fit-toggle badge ${row.meetsRequirements ? "low" : "medium"}`}
          aria-expanded={expanded}
          onClick={onToggleExpand}
        >
          {requirementsLabel}
          <ChevronDownIcon />
        </button>
        <span className={`badge ${statusBand(row.status)}`}>{statusLabel(row.status)}</span>
      </div>

      {expanded && (
        <div className="ranking-card-requirements">
          <table className="requirement-checklist">
            <thead>
              <tr>
                <th></th>
                <th>Required</th>
                <th>This site</th>
              </tr>
            </thead>
            <tbody>
              {row.requirementChecks.map((c) => (
                <tr key={c.criterion}>
                  <td>
                    <span className={`req-criterion ${c.pass ? "req-pass" : "req-fail"}`}>
                      {c.pass ? <CheckIcon /> : <XIcon />}
                      {c.criterion}
                    </span>
                  </td>
                  <td>{c.required}</td>
                  <td>{c.actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="ranking-card-footer">
        <button
          type="button"
          className="save-run-btn"
          onClick={onDraftClick}
          disabled={draftLoading}
          data-tooltip="Draft-only outreach text — no real contact email exists for this site, and this app never actually sends anything."
        >
          {draftLoading ? <span className="spinner" /> : <MailIcon className="btn-icon" />}
          {draftLabel}
        </button>
      </div>
    </div>
  );
}
