import { useEffect, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import WhyThisRating from "../risk/WhyThisRating";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import EmptyState from "../ui/EmptyState";
import SaveRunDialog from "../runs/SaveRunDialog";
import Select from "../ui/Select";
import { SaveIcon, MailIcon } from "../ui/Icons";
import { fetchOutreachDraft } from "../../services/siteCombination.service";
import { fetchRecommendationForStatus } from "../../services/pipeline.service";
import OutreachDraftModal from "../ui/OutreachDraftModal";
import type { FinalResult, OutreachDraft } from "../../types";
import { allConfiguredCountries } from "../../utils/region";

type LiveStatusFilter = "RECRUITING" | "NOT_YET_RECRUITING" | "ACTIVE_NOT_RECRUITING";

// Same three statuses/labels as the Ranking page's status filter (see
// SiteRankingPanel.tsx) — kept as its own local copy rather than shared,
// same "deliberately LOCAL to this page" approach already used for the
// country picker below.
const STATUS_OPTIONS: { value: LiveStatusFilter; label: string }[] = [
  { value: "RECRUITING", label: "Recruiting" },
  { value: "NOT_YET_RECRUITING", label: "Not Yet Recruiting" },
  { value: "ACTIVE_NOT_RECRUITING", label: "Active, Not Recruiting" },
];

function normalizeStatus(raw: string | null | undefined): LiveStatusFilter | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return STATUS_OPTIONS.some((o) => o.value === upper)
    ? (upper as LiveStatusFilter)
    : null;
}

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

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
    regionOptions,
    analysisCache,
    prefetchingCountries,
    analyzeForCountry,
  } = usePipeline();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  // When the trial form has no region/country pre-selected (the NCT-lookup
  // flow deliberately leaves this empty to search every region globally),
  // fall back to every country this app is configured to search at all,
  // rather than leaving the picker with nothing to show.
  const countryOptions =
    selectedCountries.length > 0
      ? selectedCountries
      : allConfiguredCountries(regionOptions);

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
      // No explicit region/country selection (global NCT-lookup run) —
      // default to the auto-picked top region's country, which Run
      // Analysis already fully analyzed, rather than clearing the picker to
      // empty. The broader countryOptions dropdown below still lets the
      // user switch to any other configured country from here.
      if (!pageCountry) setPageCountry(topRegion.country);
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
  const pageLoading =
    !!pageCountry && !cached && (running || analyzing || prefetchingCountries.has(pageCountry));

  // Status dropdown — "best of Recruiting / Not Yet Recruiting / Active,
  // Not Recruiting" (see backend's Stage 8: it always recommends the single
  // best site across every status combined, which can silently be a site
  // the Ranking page's default "Recruiting" filter never shows). Each
  // status's result is fetched lazily and cached per country+status so
  // switching back to one already seen is instant.
  const [statusFilter, setStatusFilter] = useState<LiveStatusFilter | "">("");
  const [recoByStatus, setRecoByStatus] = useState<Record<string, FinalResult>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // New country selected — the previous country's status choice doesn't
  // carry over; the default below re-derives once that country's overall
  // best result (already fetched by analyzeForCountry) is in.
  useEffect(() => {
    setStatusFilter("");
    setStatusError(null);
  }, [pageCountry]);

  // Seed the cache for whichever status the country's overall-best site
  // actually has, straight from the result analyzeForCountry already
  // fetched — no extra request needed for that one status.
  useEffect(() => {
    if (!pageCountry || !cached?.finalResult) return;
    const s = normalizeStatus(cached.finalResult.status);
    if (!s) return;
    const key = `${cached.analysisId ?? pageCountry}::${s}`;
    setRecoByStatus((prev) => (prev[key] ? prev : { ...prev, [key]: cached.finalResult }));
  }, [pageCountry, cached?.finalResult]);

  // Default the dropdown to that same status once it's known, so the page
  // shows exactly what it always showed until the user picks a different
  // status themselves.
  useEffect(() => {
    if (statusFilter) return;
    if (!cached?.finalResult) return;
    setStatusFilter(normalizeStatus(cached.finalResult.status) ?? "RECRUITING");
  }, [statusFilter, cached?.finalResult]);

  // Fetch the best site for the selected status when it isn't cached yet.
  useEffect(() => {
    if (!pageCountry || !statusFilter) return;
    const analysisId = cached?.analysisId;
    const key = `${analysisId ?? pageCountry}::${statusFilter}`;
    if (recoByStatus[key]) return;
    if (!analysisId) {
      setStatusError(
        "Switching status isn't available for this result — try re-selecting the country.",
      );
      return;
    }
    let cancelled = false;
    setStatusLoading(true);
    setStatusError(null);
    fetchRecommendationForStatus(analysisId, statusFilter)
      .then((res) => {
        if (cancelled) return;
        setRecoByStatus((prev) => ({ ...prev, [key]: res }));
      })
      .catch((err) => {
        if (cancelled) return;
        setStatusError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageCountry, statusFilter, cached?.analysisId, recoByStatus]);

  const finalResult =
    pageCountry && statusFilter
      ? recoByStatus[`${cached?.analysisId ?? pageCountry}::${statusFilter}`] ?? null
      : null;

  const countryPicker = countryOptions.length > 0 && (
    <div className="predict-head-actions">
      <Select
        className="country-select-wide"
        value={pageCountry}
        onChange={setPageCountry}
        placeholder="Select country to analyze…"
        options={countryOptions.map((c) => ({ value: c, label: c }))}
      />
    </div>
  );

  const statusPicker = pageCountry && (
    <div className="predict-head-actions">
      <Select
        className="status-filter-select"
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as LiveStatusFilter)}
        placeholder="Best of…"
        disabled={statusLoading}
        options={STATUS_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
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
    if (pageLoading || statusLoading) {
      // Keep the country/status pickers + action buttons visible and only
      // put the loader in the body — a bare full-card loader used to blank
      // out the dropdowns and Save/Draft buttons while a result was loading.
      return (
        <div className="card">
          <div className="pipeline-card-head map-controls map-controls--flush">
            {countryPicker}
            {statusPicker}
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
            <StageLoader
              label={
                statusLoading && statusFilter
                  ? `Loading best ${statusLabel(statusFilter)} site…`
                  : "Loading final recommendation…"
              }
            />
          </div>
        </div>
      );
    }
    if (statusError) {
      return (
        <div className="card">
          <div className="pipeline-card-head map-controls map-controls--flush">
            {countryPicker}
            {statusPicker}
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
            <EmptyState title="Could not load this recommendation" detail={statusError} />
          </div>
        </div>
      );
    }
    // No result and nothing loading/erroring — either no country is picked
    // yet, or (defensively) neither pickers below have anything to offer.
    // Previously this returned null, leaving a blank white card with no
    // explanation at all.
    return (
      <div className="card">
        <div className="pipeline-card-head map-controls map-controls--flush">
          {countryPicker}
          {statusPicker}
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
          <EmptyState
            title="No recommendation yet"
            detail={
              countryOptions.length > 0
                ? "Pick a country above to see the recommended site."
                : "Pick a region/country in Step 1 to populate this."
            }
          />
        </div>
      </div>
    );
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
      <div className="pipeline-card-head map-controls map-controls--flush">
        {countryPicker}
        {statusPicker}
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
