import { useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import WhyThisRating from "../risk/WhyThisRating";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import SaveRunDialog from "../runs/SaveRunDialog";
import { SaveIcon } from "../ui/Icons";
import { fetchOutreachDraft } from "../../services/siteCombination.service";
import type { OutreachDraft } from "../../types";

export default function RecommendationPanel() {
  const {
    finalResult,
    llmInfo,
    canSave,
    saveLabel,
    setSaveLabel,
    saving,
    saveMessage,
    handleSave,
    form,
    running,
  } = usePipeline();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Outreach draft for the recommended site — see backend
  // pipeline/outreachDraft.ts. Draft text only, never actually sent: there
  // is no live source for a facility's real contact email (ClinicalTrials.gov
  // does not reliably disclose one), so the "To:" address below is a
  // clearly-labeled SYNTHETIC placeholder, not a real inbox.
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  if (!finalResult) {
    if (running) {
      return (
        <div className="card">
          <StageLoader label="Loading final recommendation…" />
        </div>
      );
    }
    return null;
  }
  // Narrowed alias so the nested draftOutreach() below (a function
  // declaration, not a same-scope block) can reference it without
  // TypeScript widening it back to `FinalResult | null` — same value,
  // just captured after the null check above.
  const site = finalResult;

  async function draftOutreach() {
    if (draftOpen) {
      setDraftOpen(false);
      return;
    }
    if (draft) {
      setDraftOpen(true);
      return;
    }
    setDraftLoading(true);
    setDraftError(null);
    try {
      const res = await fetchOutreachDraft({
        indication: form.indication,
        phase: form.phase || undefined,
        sites: [
          {
            siteId: site.siteId,
            siteName: site.recommendedSite,
            country: site.country,
          },
        ],
      });
      if (res.drafts[0]) {
        setDraft(res.drafts[0]);
        setDraftOpen(true);
      } else {
        setDraftError("Could not generate a draft for this site.");
      }
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setDraftLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="pipeline-card-head" style={{ justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="save-run-btn"
            onClick={draftOutreach}
            disabled={draftLoading}
            title="Draft-only outreach text — no real contact email exists for this site, and this app never actually sends anything."
          >
            {draftLoading
              ? "Drafting…"
              : draftOpen
                ? "Hide draft"
                : draft
                  ? "View draft"
                  : "Draft email"}
          </button>
          {canSave && (
            <button
              type="button"
              className="save-run-btn"
              onClick={() => setSaveDialogOpen(true)}
            >
              <SaveIcon className="btn-icon" />
              Save
            </button>
          )}
        </div>
      </div>
      {draftError && (
        <p className="error-text" style={{ marginTop: 8 }}>
          {draftError}
        </p>
      )}
      <div style={{ height: "16px" }} />
      <div className="card-scroll-body">
        <div className="final-grid">
          <div className="item">
            <div className="k">Region</div>
            <div className="v">
              {finalResult.region}, {finalResult.country}
            </div>
          </div>
          <div className="item">
            <div className="k">Estimated Patient Population</div>
            <div className="v">
              {finalResult.estimatedPatients?.toLocaleString()}
            </div>
          </div>
          <div className="item">
            <div className="k">Recommended Site</div>
            <div className="v">{finalResult.recommendedSite}</div>
          </div>
          <div className="item">
            <div className="k">Site Score</div>
            <div className="v" title={finalResult.scoreExplanation}>
              {finalResult.score}/100
              {finalResult.confidence !== "High" && (
                <span className="score-confidence">
                  {" "}
                  ({finalResult.confidence.toLowerCase()} confidence)
                </span>
              )}
            </div>
          </div>
          <div className="item">
            <div className="k">Risk Level</div>
            <div className="v">{finalResult.riskLevel} Risk</div>
          </div>
        </div>

        {finalResult.riskExplanation && (
          <div className="final-why">
            <div className="final-why-title">
              Why this site is rated {finalResult.riskLevel}
            </div>
            <WhyThisRating explanation={finalResult.riskExplanation} />
          </div>
        )}

        <p className="final-text">
          <strong>AI Recommendation ({llmInfo}):</strong> {finalResult.text}
        </p>

        {draftOpen && draft && (
          <div
            className="final-why"
            style={{
              marginTop: 12,
              background: "#f7f8fb",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "13px 15px",
            }}
          >
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
            <p className="warning-text" style={{ marginTop: 0 }}>
              This is draft-only text — nothing is emailed from this app.
              ClinicalTrials.gov does not reliably disclose a real
              per-facility contact, so the address below is a fabricated
              placeholder, not a real inbox. Verify the site's actual
              contact and send from your own email tool if you want this to
              actually go out.
            </p>
            <div style={{ fontSize: 13 }}>
              <div>
                <strong>To:</strong> {draft.contactEmail}
              </div>
              <div>
                <strong>Subject:</strong> {draft.subject}
              </div>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  marginTop: 6,
                  fontFamily: "inherit",
                }}
              >
                {draft.body}
              </pre>
            </div>
          </div>
        )}
      </div>

      <WizardNextLink />

      {saveDialogOpen && (
        <SaveRunDialog
          label={saveLabel}
          onLabelChange={setSaveLabel}
          saving={saving}
          message={saveMessage}
          onSave={handleSave}
          onClose={() => setSaveDialogOpen(false)}
        />
      )}
    </div>
  );
}
