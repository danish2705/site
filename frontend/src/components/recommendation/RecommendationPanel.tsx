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
import { countriesFromRegionKeys } from "../../utils/region";

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
    analyzing,
    analyzeForCountry,
  } = usePipeline();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Country picker — same convention as Risk Register/Ranking: picking a
  // country here re-runs Stages 4-8 against just that country's live sites,
  // so the recommended site can be checked/compared country by country
  // instead of only ever showing the last-run country.
  const selectedCountries = countriesFromRegionKeys(form.regions);
  const [analysisCountry, setAnalysisCountry] = useState("");

  useEffect(() => {
    if (selectedCountries.length === 0) {
      if (analysisCountry) setAnalysisCountry("");
    } else if (!selectedCountries.includes(analysisCountry)) {
      setAnalysisCountry(selectedCountries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries.join("|")]);

  function handleCountryChange(country: string) {
    setAnalysisCountry(country);
    if (country) analyzeForCountry(country);
  }

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
    if (running || analyzing) {
      return (
        <div
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
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
      <div className="pipeline-card-head">
        {selectedCountries.length > 0 && (
          <div className="predict-head-actions">
            <Select
              value={analysisCountry}
              onChange={handleCountryChange}
              disabled={analyzing}
              placeholder="Select country to analyze…"
              options={selectedCountries.map((c) => ({ value: c, label: c }))}
            />
          </div>
        )}
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
