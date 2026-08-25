import { useEffect, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import WhyThisRating from "../risk/WhyThisRating";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import SaveRunDialog from "../runs/SaveRunDialog";
import Select from "../ui/Select";
import { SaveIcon, MailIcon } from "../ui/Icons";
import { fetchOutreachDraft } from "../../services/siteCombination.service";
import OutreachDraftModal from "../ui/OutreachDraftModal";
import type { OutreachDraft } from "../../types";

export default function RecommendationPanel() {
  const {
    llmInfo,
    canSave,
    saveLabel,
    setSaveLabel,
    saving,
    saveMessage,
    handleSave,
    form,
    running,
    analyzing,
    topRegion,
    selectedCountries,
    analysisCache,
    prefetchingCountries,
    analyzeForCountry,
  } = usePipeline();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Country picker — deliberately LOCAL to this page, not shared with Risk
  // Register/Ranking: those each keep their own selection too. All three
  // still read from the same PipelineContext analysisCache/
  // prefetchingCountries, so switching country here is instant once that
  // country has been analyzed, and only triggers a fresh fetch when it's
  // genuinely not there yet.
  const [pageCountry, setPageCountry] = useState("");

  useEffect(() => {
    if (running) return;
    if (!topRegion) return;
    if (selectedCountries.length === 0) {
      if (pageCountry) setPageCountry("");
      return;
    }
    if (!selectedCountries.includes(pageCountry)) {
      setPageCountry(
        selectedCountries.includes(topRegion.country)
          ? topRegion.country
          : selectedCountries[0],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries.join("|"), topRegion, running]);

  useEffect(() => {
    if (!pageCountry) return;
    if (analysisCache[pageCountry]) return;
    if (prefetchingCountries.has(pageCountry)) return;
    analyzeForCountry(pageCountry, { background: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCountry, analysisCache, prefetchingCountries]);

  const cached = pageCountry ? analysisCache[pageCountry] : undefined;
  const finalResult = cached?.finalResult ?? null;
  const pageLoading =
    !!pageCountry && !cached && (running || analyzing || prefetchingCountries.has(pageCountry));

  const countryPicker = selectedCountries.length > 0 && (
    <div className="predict-head-actions">
      <Select
        value={pageCountry}
        onChange={setPageCountry}
        placeholder="Select country to analyze…"
        options={selectedCountries.map((c) => ({ value: c, label: c }))}
      />
    </div>
  );

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
    if (pageLoading) {
      // Keep the country picker + action buttons visible and only put the
      // loader in the body — a bare full-card loader used to blank out the
      // dropdown and Save/Draft buttons while a country's recommendation
      // was loading.
      return (
        <div className="card">
          <div className="pipeline-card-head">
            {countryPicker}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              minHeight: 200,
            }}
          >
            <StageLoader label="Loading final recommendation…" />
          </div>
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
      <div className="pipeline-card-head">
        {countryPicker}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button
            type="button"
            className="save-run-btn"
            onClick={draftOutreach}
            disabled={draftLoading}
            data-tooltip="Draft-only outreach text — no real contact email exists for this site, and this app never actually sends anything."
          >
            {draftLoading ? (
              <span className="spinner" />
            ) : (
              <MailIcon className="btn-icon" />
            )}
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
        <div className="final-grid final-grid--reco">
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
            <div className="v" data-tooltip={finalResult.scoreExplanation}>
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

        <p className="final-text final-text--reco">
          <strong>AI Recommendation ({llmInfo}):</strong> {finalResult.text}
        </p>


      </div>

      <WizardNextLink />

      {draftOpen && draft && (
        <OutreachDraftModal draft={draft} onClose={() => setDraftOpen(false)} />
      )}

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
