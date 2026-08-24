import { Fragment, useMemo, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import ScoreBreakdown from "./ScoreBreakdown";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import { fetchOutreachDraft } from "../../services/siteCombination.service";
import type { OutreachDraft, RankingRow } from "../../types";

// Only show sites that are currently Recruiting or Active (Not Recruiting) —
// Completed/Terminated/Withdrawn/Suspended/unknown-status sites aren't useful
// candidates here, and there's no longer a status dropdown for the user to
// toggle this themselves (removed per request — the filter wasn't needed).
function isLiveActiveStatus(status: string | null): boolean {
  const s = (status ?? "").toUpperCase();
  return s === "RECRUITING" || s === "ACTIVE_NOT_RECRUITING";
}

function statusLabel(status: string | null): string {
  if (!status) return "Unknown";
  if (status.toUpperCase() === "NOT_YET_RECRUITING") {
    return "Recruiting not yet started";
  }
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function statusBand(
  status: string | null,
): "low" | "medium" | "high" | "info" | "no-data" {
  const s = (status ?? "").toUpperCase();
  if (s === "COMPLETED") return "info";
  if (s === "RECRUITING") return "low";
  if (s === "TERMINATED" || s === "WITHDRAWN" || s === "SUSPENDED") return "high";
  if (
    s === "ACTIVE_NOT_RECRUITING" ||
    s === "NOT_YET_RECRUITING" ||
    s === "ENROLLING_BY_INVITATION"
  ) {
    return "medium";
  }
  return "no-data";
}

export default function SiteRankingPanel() {
  const { ranking, form, running } = usePipeline();

  const filteredRanking = useMemo(() => {
    if (!ranking) return [];
    return ranking.filter((r) => isLiveActiveStatus(r.status));
  }, [ranking]);

  // Per-site outreach draft state — see backend pipeline/outreachDraft.ts.
  // IMPORTANT: this only ever generates draft text; it never sends an email.
  // ClinicalTrials.gov does not reliably disclose a real per-facility
  // contact, so there is no live email address to send to — the contact
  // shown is a clearly-labeled SYNTHETIC placeholder, not a real inbox.
  const [openDraftSiteId, setOpenDraftSiteId] = useState<string | null>(null);
  const [draftLoadingSiteId, setDraftLoadingSiteId] = useState<string | null>(
    null,
  );
  const [drafts, setDrafts] = useState<Record<string, OutreachDraft>>({});
  const [draftError, setDraftError] = useState<string | null>(null);

  async function draftOutreachFor(row: RankingRow) {
    if (openDraftSiteId === row.siteId) {
      // Already open — treat the button as a toggle/close.
      setOpenDraftSiteId(null);
      return;
    }
    if (drafts[row.siteId]) {
      // Already drafted this site once — just reopen it, no refetch.
      setOpenDraftSiteId(row.siteId);
      return;
    }
    setDraftLoadingSiteId(row.siteId);
    setDraftError(null);
    try {
      const res = await fetchOutreachDraft({
        indication: form.indication,
        phase: form.phase || undefined,
        sites: [{ siteId: row.siteId, siteName: row.siteName }],
      });
      if (res.drafts[0]) {
        setDrafts((prev) => ({ ...prev, [row.siteId]: res.drafts[0] }));
        setOpenDraftSiteId(row.siteId);
      } else {
        setDraftError("Could not generate a draft for this site.");
      }
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setDraftLoadingSiteId(null);
    }
  }

  if (!ranking) {
    if (running) {
      return (
        <div className="card">
          <StageLoader label="Loading site ranking…" />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="card">
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="tag">Stage 7 Output</span>
          </div>
          <div className="predict-head-actions">
            <span className="map-table-count">
              {filteredRanking.length.toLocaleString()} of{" "}
              {ranking.length.toLocaleString()} site(s)
            </span>
          </div>
        </div>
      </div>
      {draftError && <p className="error-text">{draftError}</p>}
      <div className="card-scroll-body">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Site</th>
                <th>Region</th>
                <th>Score</th>
                <th>Breakdown</th>
                <th>Protocol fit</th>
                <th>Risk</th>
                <th title="Live ClinicalTrials.gov status for this site.">
                  Status
                </th>
                <th title="Draft-only outreach text — no real contact email exists for these sites, and this app never actually sends anything.">
                  Outreach
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.length === 0 && (
                <tr>
                  <td colSpan={9} className="predict-placeholder">
                    No Recruiting or Active (Not Recruiting) sites found.
                  </td>
                </tr>
              )}
              {filteredRanking.map((r) => (
                <Fragment key={r.siteId}>
                <tr>
                  <td>{r.rank}</td>
                  <td>
                    {r.siteName}
                    <div className="site-id">{r.siteId}</div>
                  </td>
                  <td>{r.region}</td>
                  <td>
                    {r.score}/100
                    {r.confidence !== "High" && (
                      <div
                        className="score-confidence"
                        title={r.caveats.join(" ")}
                      >
                        {r.confidence.toLowerCase()} confidence
                      </div>
                    )}
                  </td>
                  <td>
                    <ScoreBreakdown
                      components={r.components}
                      liveKpiFields={r.liveKpiFields}
                      liveKpiSourceNctId={r.liveKpiSourceNctId}
                      raceBreakdown={r.raceBreakdown}
                    />
                  </td>
                  <td>
                    {r.meetsRequirements ? (
                      <span className="badge low">Meets all</span>
                    ) : (
                      <span
                        className="badge medium"
                        title={`Fails: ${r.failedCriteria.join(", ")}`}
                      >
                        {r.failedCriteria.length} unmet
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.riskLevel.toLowerCase()}`}>
                      {r.riskLevel}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${statusBand(r.status)}`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="predict-btn"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => draftOutreachFor(r)}
                      disabled={draftLoadingSiteId === r.siteId}
                    >
                      {draftLoadingSiteId === r.siteId
                        ? "Drafting…"
                        : openDraftSiteId === r.siteId
                          ? "Hide draft"
                          : drafts[r.siteId]
                            ? "View draft"
                            : "Draft email"}
                    </button>
                  </td>
                </tr>
                {openDraftSiteId === r.siteId && drafts[r.siteId] && (
                  <tr>
                    <td colSpan={9} style={{ background: "#f7f8fb" }}>
                      <div style={{ padding: "10px 4px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <strong>Outreach draft (not sent)</strong>
                          <span className="chip">synthetic contact</span>
                        </div>
                        <p
                          className="warning-text"
                          style={{ marginTop: 0 }}
                        >
                          This is draft-only text — nothing is emailed
                          from this app. ClinicalTrials.gov does not
                          reliably disclose a real per-facility contact,
                          so the address below is a fabricated
                          placeholder, not a real inbox. Verify the
                          site's actual contact and send from your own
                          email tool if you want this to actually go
                          out.
                        </p>
                        <div style={{ fontSize: 13 }}>
                          <div>
                            <strong>To:</strong>{" "}
                            {drafts[r.siteId].contactEmail}
                          </div>
                          <div>
                            <strong>Subject:</strong>{" "}
                            {drafts[r.siteId].subject}
                          </div>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              marginTop: 6,
                              fontFamily: "inherit",
                            }}
                          >
                            {drafts[r.siteId].body}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <WizardNextLink />
    </div>
  );
}
