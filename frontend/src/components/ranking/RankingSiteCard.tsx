import { useRef } from "react";
import ScoreBreakdown from "./ScoreBreakdown";
import RequirementChecklistPopover from "./RequirementChecklistPopover";
import Tooltip from "../ui/Tooltip";
import { MailIcon, ChevronDownIcon } from "../ui/Icons";
import type { RankingRow } from "../../types";

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
  const protocolFitRef = useRef<HTMLButtonElement>(null);

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
            <Tooltip as="div" text={row.caveats.join(" ")} className="score-confidence">
              {row.confidence.toLowerCase()} confidence
            </Tooltip>
          )}
        </div>
      </div>

      <div className="ranking-card-scroll">
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
            ref={protocolFitRef}
            type="button"
            className={`protocol-fit-toggle badge ${row.meetsRequirements ? "low" : "medium"}`}
            aria-expanded={expanded}
            aria-haspopup="dialog"
            onClick={onToggleExpand}
          >
            {requirementsLabel}
            <ChevronDownIcon />
          </button>
          <span className={`badge ${statusBand(row.status)}`}>{statusLabel(row.status)}</span>
        </div>
      </div>

      <RequirementChecklistPopover
        anchorRef={protocolFitRef}
        open={expanded}
        onClose={onToggleExpand}
        checks={row.requirementChecks}
      />

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
