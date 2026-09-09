import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  TrialForm,
  MetaResponse,
  StagesMap,
  RankingRow,
  SavedRunSummary,
  SavedRunDetail,
  RiskAssessmentRow,
  FinalResult,
  StageEventPayload,
  LiveFacilityRow,
  NctLookupResponse,
} from "../types";
import { STAGE_LIST } from "../constants/pipeline";
import type { WorkflowStep } from "../constants/workflow";
import { fetchMeta } from "../services/meta.service";
import { streamRun, streamSiteAnalysis } from "../services/pipeline.service";
import { fetchLiveTrialLandscape } from "../services/liveTrials.service";
import { createRun, getRun, listRuns } from "../services/runs.service";
import { useRoute } from "./RouteContext";
import { countriesFromRegionKeys, countryMatches } from "../utils/region";
 
/** Same last-3-years recency window CompetingTrialsPanel applies to its own
 * table — reused here so a country picked directly from Risk Register goes
 * through the identical "not too much stale history" filter instead of a
 * second, looser definition of "recent." */
function filterRecentFacilities(facilities: LiveFacilityRow[]): LiveFacilityRow[] {
  const RECENT_YEARS = 3;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RECENT_YEARS);
  return facilities.filter((f) => {
    if (!f.lastUpdatePostDate) return false;
    const d = new Date(f.lastUpdatePostDate);
    return !isNaN(d.getTime()) && d >= cutoff;
  });
}
 
/** Backend's POST /api/site-analysis requires every facility row to carry a
 * usable name (see siteAnalysis.controller.ts's parseFacilities) — some
 * ClinicalTrials.gov records legitimately omit it. Drop those here so a
 * country whose live data happens to include one of these blank-name rows
 * doesn't 400 the whole analysis; only the unusable rows are dropped, not
 * the whole batch. */
function filterAnalyzableFacilities(
  facilities: LiveFacilityRow[],
): LiveFacilityRow[] {
  return facilities.filter(
    (f) => typeof f.facility === "string" && f.facility.trim().length > 0,
  );
}
 
/** The top-scoring region/country Stage 2 resolved — just enough to call
 * /api/site-analysis later (see analyzeOngoingTrialSites below). */
interface TopRegionInfo {
  region: string;
  country: string;
}
 
/** Everything a completed analyzeForCountry() run for one country produces —
 * cached so Risk Register/Ranking/Final Recommendation can switch back to an
 * already-analyzed country instantly instead of re-running Stages 4-8. */
interface CountryAnalysis {
  riskAssessment: RiskAssessmentRow[];
  ranking: RankingRow[];
  finalResult: FinalResult;
  ongoingTrialSites: LiveFacilityRow[];
  topRegion: TopRegionInfo;
  /** finalResult.analysisId, hoisted up so RecommendationPanel does not need
   * to reach into finalResult for it — null when this analysis predates the
   * status-dropdown feature or the backend omitted it. */
  analysisId: string | null;
}
 
/**
 * Shared SSE "stage"/"error" event reader for both the initial /api/run
 * stream and the later /api/site-analysis stream — both endpoints emit the
 * identical event format (see backend's postRun/postSiteAnalysis). Calls
 * `onStage` for every "stage" event and `onError` for an "error" event.
 */
async function consumeStageStream(
  res: Response,
  onStage: (payload: StageEventPayload) => void,
  onError: (message: string) => void,
): Promise<void> {
  if (!res.body) {
    throw new Error("Streaming not supported by this browser/response.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
 
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      let eventName = "message";
      let dataStr = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      const payload = JSON.parse(dataStr) as StageEventPayload & {
        message?: string;
      };
      if (eventName === "stage") onStage(payload);
      else if (eventName === "error") onError(payload.message ?? "Unknown error");
    }
  }
}
 
function emptyStages(): StagesMap {
  const obj: StagesMap = {};
  for (const s of STAGE_LIST)
    obj[s.n] = { status: "pending", detail: null, data: null };
  return obj;
}
 
export interface PipelineState {
  meta: MetaResponse | null;
  form: TrialForm;
  setForm: (updater: TrialForm | ((f: TrialForm) => TrialForm)) => void;
  regionOptions: { indication: string; region: string; country: string }[];
 
  stages: StagesMap;
  running: boolean;
  llmInfo: string | null;
  finalResult: FinalResult | null;
  ranking: RankingRow[] | null;
  riskAssessment: RiskAssessmentRow[] | null;
  error: string | null;
  /** Non-blocking informational notice (e.g. a data-source fallback) —
   *  shown as a dismissible Toast rather than the red error banner, since
   *  it doesn't affect what the user can do next. */
  notice: string | null;
  dismissNotice: () => void;
 
  /** The live ClinicalTrials.gov rows currently loaded on the Ongoing Trials tab — set by CompetingTrialsPanel after each search, consumed by analyzeOngoingTrialSites. */
  ongoingTrialSites: LiveFacilityRow[] | null;
  setOngoingTrialSites: (sites: LiveFacilityRow[]) => void;
  /** True while Stages 4-8 are running against ongoingTrialSites (POST /api/site-analysis) — distinct from `running`, which covers the initial Stages 1-3 run. */
  analyzing: boolean;
  /** Sends ongoingTrialSites to Risk Register/Ranking for analysis — see services/pipeline.service.ts's streamSiteAnalysis. */
  analyzeOngoingTrialSites: () => Promise<void>;
  /** True once Stage 2 of Run Analysis has resolved a region/country — analyzeOngoingTrialSites needs this, so CompetingTrialsPanel uses it to keep "Send to Risk Assessment & Ranking" disabled (and to explain why) until Run Analysis has actually run. */
  hasTopRegion: boolean;
  /** The actual region/country Stage 2 resolved (not just whether it exists) — Risk Register/Ranking/Final Recommendation each use this to default their own (independent) country picker to it. */
  topRegion: TopRegionInfo | null;
  /** Risk Register's own Country picker: fetches a fresh live facility list for `country` itself (same live-trials call Ongoing Trials makes), then sends it straight to Stages 4-8 — the whole "search + analyze" round-trip in one action, so Risk Register/Ranking can be re-run for any country in the trial's selected regions without going through the Ongoing Trials tab at all. */
  /** Runs Stages 4-8 for one country and returns its top recommended site (or null on failure/no-sites) — used by the single-country picker on Risk Register/Ranking/Final Recommendation. Pass `background: true` to run it as a silent prefetch (see analysisCache below) — it won't touch the error banner, the shared loading flags, or the currently-displayed riskAssessment/ranking/finalResult. */
  analyzeForCountry: (
    country: string,
    opts?: { background?: boolean },
  ) => Promise<FinalResult | null>;
 
  /** De-duplicated countries behind the trial form's selected region(s) —
   * the "set" of countries Risk Register/Ranking/Final Recommendation can
   * each be pointed at. Computed once here instead of separately in each of
   * those three components. */
  selectedCountries: string[];
  /** The country Risk Register/Ranking/Final Recommendation are currently
   * showing. Setting it (via setAnalysisCountry) is what actually resolves
   * data for it — either instantly from analysisCache if it's already been
   * analyzed, or by kicking off analyzeForCountry if not. Shared across all
   * three pages so picking a country on one keeps the others in sync. */
  analysisCountry: string;
  /** Switches the shown country. Looks up analysisCache first: a hit swaps
   * riskAssessment/ranking/finalResult in immediately with no network call;
   * a miss calls analyzeForCountry(country) to fetch it (same as picking it
   * from the dropdown always did). This replaces the old per-page "display
   * only" default effect that never actually triggered analysis. */
  setAnalysisCountry: (country: string) => void;
  /** Every country analyzeForCountry has completed for this session, so the
   * three pages above can show data instantly when the user switches back
   * to one. Cleared when the indication changes (a fresh set of countries
   * needs fresh analysis). */
  analysisCache: Record<string, CountryAnalysis>;
  /** Countries currently being analyzed in the background (queued via the
   * auto-prefetch effect below) — exposed so a picker can show which
   * not-yet-viewed countries are still being worked on. */
  prefetchingCountries: Set<string>;
  /** Why analyzeForCountry came back empty for a given country (e.g. zero
   * live ClinicalTrials.gov sites in the last 3 years) — background
   * prefetches don't raise the shared error banner (see analyzeForCountry),
   * so without this a country that's simply never going to have data would
   * show the same generic "No risk data yet" as one that just hasn't been
   * analyzed yet, with no way to tell the two apart. Cleared for a country
   * the moment it's successfully analyzed. */
  countryErrors: Record<string, string>;
 
  completedCount: number;
  progressPct: number;
  pipelineDone: boolean;
  /** Human-readable "Stage N of 8: <label>" for whichever stage is currently running — drives the full-screen loading overlay shown while `running` is true. null when not running. */
  runningStageLabel: string | null;
 
  /** Availability guard for the guided workflow nav (WorkflowNav) and WizardNextLink — same rules the old 5-step wizardStepAvailable used, just extended to cover the 3 Site Map pages (always available, same as before when they were an always-reachable tab). "Predict Region with AI" is no longer a workflow step — it's a modal opened from the sidebar, not gated by this function. */
  workflowStepAvailable: (step: WorkflowStep) => boolean;

  /** Set once an analysis was started from the landing page's NCT-lookup flow via runAnalysisFromNct — the NCT id being scoped to. When set, Ongoing Trials/Risk Assessment/Site Ranking/Site Map/Recommendation all run against ONLY this trial's own disclosed sites (nctScopeFacilities) instead of the default broad indication-wide ClinicalTrials.gov search. null for a normal (manual or indication-only) run. */
  nctScope: string | null;
  /** This trial's own disclosed site/location list (every country) — the source analyzeForCountry filters by country from while nctScope is set. */
  nctScopeFacilities: LiveFacilityRow[];

  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Runs Stages 1-8 for an explicit form (no submit event needed) — used by the full-page/modal Analysis Parameters forms (ParametersFormPage, EditParametersModal) to run the analysis with no native form submit needed. Call setForm with the same values first so the UI (parameters form, saved-run metadata) reflects what's actually running. Clears nctScope, if any — this is the broad, indication-wide analysis, not a single-trial audit. */
  runAnalysis: (formToUse: TrialForm) => Promise<void>;
  /** The landing page's "Search by NCT Number" flow calls this instead of runAnalysis — scopes Ongoing Trials/Risk Assessment/Site Ranking/Site Map/Recommendation to ONLY the looked-up trial's own disclosed sites (lookup.facilities), rather than running the full Stage 1-3 broad indication-wide prediction. Sets nctScope so every downstream panel knows to stay scoped. Errors (via the shared `error` state) if the study discloses no usable site locations to scope to. */
  runAnalysisFromNct: (
    lookup: NctLookupResponse,
    formToUse: TrialForm,
  ) => Promise<void>;
  /** Aborts the in-flight Run Analysis stream — see RunAnalysisOverlay's Cancel button. No-op if nothing is running. */
  cancelRun: () => void;
  /** Increments every time cancelRun() actually cancels an in-flight run — App.tsx watches this to re-expand the Analysis Parameters sidebar, which auto-collapses once a run starts (the sidebar has no other reason to reopen on its own after a cancel, unlike a normal completed/failed run where the user can just use the collapse toggle). */
  cancelSignal: number;
 
  // Saved runs
  saveLabel: string;
  setSaveLabel: (label: string) => void;
  saving: boolean;
  saveMessage: string | null;
  savedRuns: SavedRunSummary[] | null;
  openRun: SavedRunDetail | null;
  setOpenRun: (run: SavedRunDetail | null) => void;
  loadingRuns: boolean;
  canSave: boolean;
  handleSave: () => Promise<boolean>;
  loadSavedRuns: () => Promise<void>;
  openSavedRun: (id: string) => Promise<void>;
  openingRunId: string | null;
  openRunError: string | null;
}
 
export const PipelineContext = createContext<PipelineState | null>(null);
 
export function PipelineProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [form, setFormState] = useState<TrialForm>({
    indication: "",
    phase: "",
    sampleSize: "",
    durationMonths: "",
    budgetTier: "",
    regions: [],
    ageGroups: [],
  });
  // Mirrors `form`, updated synchronously (inside the setFormState updater,
  // so it's current the instant setForm returns) — analyzeForCountry reads
  // this instead of the `form` closure because runAnalysisFromNct calls
  // setForm(formToUse) and then immediately (same tick, before React
  // re-renders) awaits analyzeForCountry(...): without this ref,
  // analyzeForCountry would still see whatever `form` was at the START of
  // this render (e.g. the empty initial form on the very first NCT-lookup
  // run) and wrongly bail out with "Select an indication...".
  const formRef = useRef<TrialForm>(form);
  function setForm(updater: TrialForm | ((f: TrialForm) => TrialForm)): void {
    setFormState((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (f: TrialForm) => TrialForm)(prev)
          : updater;
      formRef.current = next;
      return next;
    });
  }
  const [stages, setStages] = useState<StagesMap>(emptyStages());
  const [running, setRunning] = useState(false);
  const [llmInfo, setLlmInfo] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<
    RiskAssessmentRow[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ongoingTrialSites, setOngoingTrialSites] = useState<
    LiveFacilityRow[] | null
  >(null);
  const [analyzing, setAnalyzing] = useState(false);
  // nctScope: set by runAnalysisFromNct, cleared by runAnalysis. Mirrored
  // into refs so analyzeForCountry (which may be invoked synchronously
  // right after runAnalysisFromNct sets this state, before React re-renders)
  // always reads the up-to-date value instead of a stale closure.
  const [nctScope, setNctScopeState] = useState<string | null>(null);
  const [nctScopeFacilities, setNctScopeFacilitiesState] = useState<
    LiveFacilityRow[]
  >([]);
  const nctScopeRef = useRef<string | null>(null);
  const nctScopeFacilitiesRef = useRef<LiveFacilityRow[]>([]);
  function applyNctScope(nctId: string | null, facilities: LiveFacilityRow[]): void {
    nctScopeRef.current = nctId;
    nctScopeFacilitiesRef.current = facilities;
    setNctScopeState(nctId);
    setNctScopeFacilitiesState(facilities);
  }
  const [topRegion, setTopRegion] = useState<TopRegionInfo | null>(null);
  const [analysisCountryState, setAnalysisCountryState] = useState("");
  const [analysisCache, setAnalysisCache] = useState<
    Record<string, CountryAnalysis>
  >({});
  const [prefetchingCountries, setPrefetchingCountries] = useState<
    Set<string>
  >(new Set());
  const [countryErrors, setCountryErrors] = useState<Record<string, string>>(
    {},
  );
  // Sequential background-prefetch queue — see the auto-prefetch effect
  // below. A ref (not state) for the "currently processing" guard so the
  // queue-draining effect doesn't need itself as a dependency.
  const [prefetchQueue, setPrefetchQueue] = useState<string[]>([]);
  const prefetchInFlightRef = useRef(false);
  const { setRoute } = useRoute();
  // Holds the AbortController for whichever Run Analysis stream is
  // currently in flight, so cancelRun() can stop it — see handleSubmit.
  const runAbortRef = useRef<AbortController | null>(null);
 
  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<SavedRunSummary[] | null>(null);
  const [openRun, setOpenRun] = useState<SavedRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [openingRunId, setOpeningRunId] = useState<string | null>(null);
  const [openRunError, setOpenRunError] = useState<string | null>(null);
  const [cancelSignal, setCancelSignal] = useState(0);
 
  const canSave = !running && !!ranking && ranking.length > 0;
 
  function workflowStepAvailable(step: WorkflowStep): boolean {
    // Every numbered step (1-7) needs Run Analysis to have actually been
    // clicked — only "Predict Region with AI" (not gated by this function
    // at all, see WorkflowNav) is reachable beforehand. The 3 Site Map
    // pages plot/plan around the region Run Analysis resolves at Stage 2,
    // same dependency as Ongoing Trials below, so picking an Indication
    // alone is no longer enough to unlock them.
    if (
      step === "site-map-global" ||
      step === "site-map-details" ||
      step === "site-combination"
    ) {
      return !!topRegion || running || analyzing;
    }
    // Ongoing Trials feeds Risk Register/Ranking now (see
    // analyzeOngoingTrialSites), which needs the region/country Run
    // Analysis resolves at Stage 2 — so this step (and its "Send to Risk
    // Assessment & Ranking" action) isn't reachable just from picking an
    // indication anymore; Run Analysis has to have actually been run.
    if (step === "competing") return !!topRegion || running || analyzing;
    // Reachable as soon as the pipeline is running (not only once its data
    // has arrived) so the nav can be clicked mid-run — the page itself
    // shows a loading state for whichever of these 3 stages hasn't
    // completed yet, rather than being unreachable until it has. Also
    // stays unlocked once `topRegion` exists (Run Analysis has completed
    // at least once) — otherwise re-analyzing a different country from
    // Risk Register's own country picker (analyzeForCountry) would
    // temporarily clear riskAssessment/ranking/finalResult to null, and if
    // that country turns out to have no live sites the request bails out
    // with `analyzing` back to false too, re-locking this whole step and
    // hiding the error message behind the generic "not available" screen
    // instead of showing it.
    if (step === "risk") return !!riskAssessment || running || analyzing || !!topRegion;
    if (step === "ranking") return !!ranking || running || analyzing || !!topRegion;
    return !!finalResult || running || analyzing || !!topRegion;
  }
 
  async function handleSave(): Promise<boolean> {
    if (!canSave || !ranking) return false;
    setSaving(true);
    setSaveMessage(null);
    try {
      const stage1Data = stages[1]?.data as {
        phase?: string;
        targetSampleSize?: number;
        durationMonths?: number;
        budgetTier?: string;
      } | null;
      await createRun({
        label: saveLabel,
        indication: form.indication,
        phase: stage1Data?.phase ?? form.phase,
        sampleSize: stage1Data?.targetSampleSize ?? form.sampleSize,
        durationMonths: stage1Data?.durationMonths ?? form.durationMonths,
        budgetTier: stage1Data?.budgetTier ?? form.budgetTier,
        region: finalResult?.region,
        country: finalResult?.country,
        estimatedPatients: finalResult?.estimatedPatients,
        llm: llmInfo,
        final: finalResult,
        ranking,
      });
      setSaveLabel("");
      setSaveMessage("Saved.");
      await loadSavedRuns();
      return true;
    } catch (err) {
      setSaveMessage((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
 
  async function loadSavedRuns() {
    setLoadingRuns(true);
    try {
      setSavedRuns(await listRuns());
    } catch (err) {
      setSaveMessage((err as Error).message);
      setSavedRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }
 
  async function openSavedRun(id: string) {
    setOpeningRunId(id);
    setOpenRunError(null);
    try {
      const detail = await getRun(id);
      if (!detail.sites || detail.sites.length === 0) {
        console.warn(
          `[openSavedRun] run ${id} loaded with no ranked sites — the detail modal will look empty.`,
          detail,
        );
      }
      setOpenRun(detail);
    } catch (err) {
      console.error(`[openSavedRun] failed to open run ${id}:`, err);
      setOpenRunError((err as Error).message);
    } finally {
      setOpeningRunId(null);
    }
  }
 
  useEffect(() => {
    fetchMeta()
      .then((data) => {
        setMeta(data);
        // metaWarning means indications fell back to a static list because
        // the live ClinicalTrials.gov vocabulary lookup returned nothing —
        // the fallback list is used silently, with no visible banner at
        // all, per explicit request. Details remain available in the
        // Data Transparency modal for anyone who wants them.
      })
      .catch((err: Error) =>
        setError(`Could not reach backend: ${err.message}`),
      );
  }, []);
 
  const completedCount = Object.values(stages).filter(
    (s) => s.status === "complete",
  ).length;
  const progressPct = Math.round((completedCount / STAGE_LIST.length) * 100);
  const pipelineDone = completedCount === STAGE_LIST.length;
  const runningStageLabel = (() => {
    if (!running) return null;
    const inProgress = STAGE_LIST.find((s) => stages[s.n]?.status === "in-progress");
    if (inProgress) return `Stage ${inProgress.n} of ${STAGE_LIST.length}: ${inProgress.label}`;
    const nextPending = STAGE_LIST.find((s) => stages[s.n]?.status === "pending");
    if (nextPending) return `Stage ${nextPending.n} of ${STAGE_LIST.length}: ${nextPending.label}`;
    return "Finalizing recommendation…";
  })();
  // Region options are no longer indication-specific — every region/country
  // in data/regionMap.ts (backend) applies to every indication now, so the
  // old indication-equality filter (which relied on Region_Data being
  // per-indication) is removed. `meta.regionOptions` entries carry a "*"
  // wildcard `indication` field for backward compatibility with the
  // RegionOption type, but nothing filters on it anymore.
  const regionOptions = useMemo(() => meta?.regionOptions ?? [], [meta]);
 
  /**
   * The actual "Run Analysis" logic (Stages 1-8), split out of handleSubmit
   * so it can be triggered without a real form submit event — the landing
   * page's NCT-lookup flow auto-fills TrialForm fields and calls this
   * directly, with zero manual form interaction. Takes the form to run
   * explicitly (rather than reading the `form` state) since a caller that
   * just called setForm(...) can't rely on that state update having landed
   * yet by the time this runs.
   */
  async function runAnalysis(formToUse: TrialForm) {
    if (!formToUse.indication) {
      setError("Please select an indication before running the analysis.");
      return;
    }
    // A manual/full run is the broad, indication-wide analysis — not a
    // single-trial audit, so any NCT scope from a previous landing-page
    // lookup no longer applies.
    applyNctScope(null, []);
    setStages(emptyStages());
    setFinalResult(null);
    setRanking(null);
    setRiskAssessment(null);
    setLlmInfo(null);
    setError(null);
    setRunning(true);
    // Re-running can change phase/sampleSize/budgetTier/ageGroups, all of
    // which feed Stages 4-8 — any previously cached per-country analysis
    // (and anything still queued to be prefetched under the old params) is
    // stale the moment a new run starts.
    setAnalysisCache({});
    setPrefetchQueue([]);
    setPrefetchingCountries(new Set());
    setCountryErrors({});
    // No auto-navigate here anymore — a full-screen loading overlay (see
    // RunAnalysisOverlay, rendered in App.tsx while `running` is true) now
    // covers the screen instead, so there's nothing to navigate away from
    // until the whole pipeline finishes (see the navigate-to-Ongoing-Trials
    // call after the stream completes below).
    let streamFailed = false;
    const abortController = new AbortController();
    runAbortRef.current = abortController;
    let runTopRegion: TopRegionInfo | null = null;
    let runRisk: RiskAssessmentRow[] | null = null;
    let runRanking: RankingRow[] | null = null;
 
    try {
      const res = await streamRun(formToUse, abortController.signal);
      await consumeStageStream(
        res,
        (payload) => {
          setStages((prev) => ({
            ...prev,
            [payload.stage]: {
              status: payload.status,
              detail: payload.detail ?? prev[payload.stage]?.detail ?? null,
              data: payload.data ?? prev[payload.stage]?.data ?? null,
            },
          }));
          if (payload.stage === 2 && payload.status === "complete") {
            // First entry of Stage 2's ranked-regions list is the one Stage 3
            // onward actually used (topRegion in runPipeline.ts) — stashed
            // here so analyzeOngoingTrialSites() can send the same
            // region/country to /api/site-analysis later.
            const top = (payload.data as { region: string; country: string }[])?.[0];
            if (top) {
              runTopRegion = { region: top.region, country: top.country };
              setTopRegion(runTopRegion);
            }
          }
          if (payload.stage === 8 && payload.llm) setLlmInfo(payload.llm);
          if (payload.stage === 6 && payload.status === "complete") {
            runRisk = payload.data as RiskAssessmentRow[];
            setRiskAssessment(runRisk);
            // No forced navigation to the Risk Register page here — the
            // user lands on Site Map (Global) when the run starts and
            // stays wherever they are; the nav bar's "complete" badge and
            // WizardNextLink both surface that this step is now ready
            // without yanking them off whatever page they're looking at.
          }
          if (payload.stage === 7 && payload.status === "complete") {
            runRanking = payload.data as RankingRow[];
            setRanking(runRanking);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            const finalRes = payload.data as FinalResult;
            setFinalResult(finalRes);
            // Seeds analysisCache for the auto-picked top region with this
            // run's own result — since it's already been fully analyzed,
            // there's no reason for the background-prefetch effect (or a
            // later setAnalysisCountry call) to re-run Stages 4-8 for it.
            if (runTopRegion && runRisk && runRanking) {
              setAnalysisCountryState(runTopRegion.country);
              setAnalysisCache((prev) => ({
                ...prev,
                [runTopRegion!.country]: {
                  riskAssessment: runRisk!,
                  ranking: runRanking!,
                  finalResult: finalRes,
                  ongoingTrialSites: ongoingTrialSites ?? [],
                  topRegion: runTopRegion!,
                  analysisId: finalRes.analysisId ?? null,
                },
              }));
            }
          }
        },
        (message) => {
          streamFailed = true;
          setError(message);
        },
      );
    } catch (err) {
      streamFailed = true;
      // A user-initiated cancelRun() aborts the fetch, which rejects with
      // an AbortError here — that's expected, not a real failure, so it
      // shouldn't surface as an error banner the way a genuine stream
      // failure does.
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setRunning(false);
      runAbortRef.current = null;
      // On success, land the user on Ongoing Trials once the whole pipeline
      // (Stages 1-8) has actually finished — replaces the old
      // navigate-immediately-to-Site-Map-(Global) behavior now that a
      // full-screen loading overlay covers the run instead. On failure (or
      // cancellation), stay put so the error banner (if any) is visible
      // against whatever page the user was already on.
      if (!streamFailed) setRoute("competing");
    }
  }
 
  /**
   * The landing page's "Search by NCT Number" flow calls this instead of
   * runAnalysis(). Rather than running the full Stage 1-3 broad
   * indication-wide prediction (which would surface every OTHER trial for
   * the same indication — the "why am I seeing other NCT codes" behavior
   * this whole flow exists to avoid), this scopes Ongoing Trials/Risk
   * Assessment/Site Ranking/Site Map/Recommendation to ONLY the looked-up
   * trial's own disclosed sites (lookup.facilities), reusing the same
   * per-country /api/site-analysis pipeline analyzeForCountry already
   * drives (Stages 4-8) — just sourced from this one trial's own site list
   * instead of a fresh broad ClinicalTrials.gov search.
   */
  async function runAnalysisFromNct(
    lookup: NctLookupResponse,
    formToUse: TrialForm,
  ): Promise<void> {
    if (!formToUse.indication) {
      setError("Please select an indication before running the analysis.");
      return;
    }
    const scopedFacilities = filterAnalyzableFacilities(lookup.facilities ?? []);
    if (scopedFacilities.length === 0) {
      setError(
        `${lookup.nctId} doesn't disclose any usable site locations, so it can't be scoped to a site-level analysis — try "Enter Study Details Manually" for a full indication-wide search instead.`,
      );
      return;
    }
    const countryCounts = new Map<string, number>();
    for (const f of scopedFacilities) {
      if (!f.country) continue;
      countryCounts.set(f.country, (countryCounts.get(f.country) ?? 0) + 1);
    }
    if (countryCounts.size === 0) {
      setError(
        `${lookup.nctId}'s disclosed sites are missing country information, so a site-level analysis can't be scoped to them.`,
      );
      return;
    }

    setForm(formToUse);
    setStages(emptyStages());
    setFinalResult(null);
    setRanking(null);
    setRiskAssessment(null);
    setLlmInfo(null);
    setError(null);
    setNotice(null);
    setOngoingTrialSites(null);
    setTopRegion(null);
    setAnalysisCountryState("");
    setAnalysisCache({});
    setPrefetchQueue([]);
    setPrefetchingCountries(new Set());
    setCountryErrors({});
    applyNctScope(lookup.nctId, scopedFacilities);

    // Default/foreground view: whichever disclosed country has the most of
    // this trial's own sites. The rest of its countries are picked up
    // automatically by the existing auto-prefetch effects below (they queue
    // every entry in `selectedCountries` once `topRegion` is set, which
    // analyzeForCountry does as soon as this first call succeeds).
    const primaryCountry = [...countryCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    const primaryResult = await analyzeForCountry(primaryCountry);
    if (primaryResult) setAnalysisCountryState(primaryCountry);
    setRoute("competing");
  }

  /** Kept only for any leftover native <form onSubmit> usage — thin wrapper around runAnalysis(). ParametersFormPage/EditParametersModal call runAnalysis directly instead so they can control the transition (dashboard handoff / modal close) around it. */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runAnalysis(form);
  }
 
  function cancelRun(): void {
    if (!runAbortRef.current) return;
    runAbortRef.current.abort();
    setCancelSignal((n) => n + 1);
  }
 
  /**
   * Sends whatever's currently loaded on the Ongoing Trials tab
   * (ongoingTrialSites) to the backend to run Stages 4-8 against — see
   * services/pipeline.service.ts's streamSiteAnalysis. Overwrites
   * riskAssessment/ranking/finalResult with the result, same as Stage
   * 6/7/8 of the initial run do, so Risk Register/Ranking always reflect
   * whichever site set was analyzed most recently.
   */
  async function analyzeOngoingTrialSites(): Promise<void> {
    if (!ongoingTrialSites || ongoingTrialSites.length === 0) {
      setError("Search Ongoing Trials first — there are no live sites to analyze yet.");
      return;
    }
    if (!topRegion) {
      setError("Run the initial analysis first so a region/country is selected.");
      return;
    }
    const facilities = filterAnalyzableFacilities(ongoingTrialSites);
    if (facilities.length === 0) {
      setError(
        "None of the loaded live sites have a usable facility name to analyze.",
      );
      return;
    }
    setAnalyzing(true);
    setError(null);
    setRanking(null);
    setRiskAssessment(null);
    setFinalResult(null);
    let localRisk: RiskAssessmentRow[] | null = null;
    let localRanking: RankingRow[] | null = null;
    let localResult: FinalResult | null = null;
    const localTopRegion = topRegion;
 
    try {
      const res = await streamSiteAnalysis({
        indication: form.indication,
        phase: form.phase || undefined,
        sampleSize: form.sampleSize,
        durationMonths: form.durationMonths,
        budgetTier: form.budgetTier || undefined,
        ageGroups: form.ageGroups,
        region: topRegion.region,
        country: topRegion.country,
        facilities,
      });
      await consumeStageStream(
        res,
        (payload) => {
          setStages((prev) => ({
            ...prev,
            [payload.stage]: {
              status: payload.status,
              detail: payload.detail ?? prev[payload.stage]?.detail ?? null,
              data: payload.data ?? prev[payload.stage]?.data ?? null,
            },
          }));
          if (payload.stage === 8 && payload.llm) setLlmInfo(payload.llm);
          if (payload.stage === 6 && payload.status === "complete") {
            localRisk = payload.data as RiskAssessmentRow[];
            setRiskAssessment(localRisk);
          }
          if (payload.stage === 7 && payload.status === "complete") {
            localRanking = payload.data as RankingRow[];
            setRanking(localRanking);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            localResult = payload.data as FinalResult;
            setFinalResult(localResult);
          }
        },
        (message) => setError(message),
      );
      // Also refresh this country's entry in the shared per-country cache —
      // each of Risk Register/Ranking/Final Recommendation now reads from
      // analysisCache for whichever country THEY have selected (they no
      // longer share one "current country" across pages), so a re-analysis
      // triggered from Ongoing Trials needs to land there too, not just in
      // these shared display slots.
      if (localRisk && localRanking && localResult && localTopRegion) {
        setAnalysisCache((prev) => ({
          ...prev,
          [localTopRegion.country]: {
            riskAssessment: localRisk!,
            ranking: localRanking!,
            finalResult: localResult!,
            ongoingTrialSites: facilities,
            topRegion: localTopRegion,
            analysisId: localResult!.analysisId ?? null,
          },
        }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }
 
  async function analyzeForCountry(
    country: string,
    opts?: { background?: boolean },
  ): Promise<FinalResult | null> {
    const background = !!opts?.background;
    if (!formRef.current.indication) {
      if (!background) setError("Select an indication before analyzing a country.");
      return null;
    }
    const regionMatch = regionOptions.find((r) => r.country === country);
    const region = regionMatch?.region ?? country;
 
    if (background) {
      setPrefetchingCountries((prev) => new Set(prev).add(country));
    } else {
      setAnalyzing(true);
      setError(null);
      setRanking(null);
      setRiskAssessment(null);
      setFinalResult(null);
    }
    let result: FinalResult | null = null;
    let localRisk: RiskAssessmentRow[] | null = null;
    let localRanking: RankingRow[] | null = null;
    const localTopRegion: TopRegionInfo = { region, country };

    try {
      let facilities: LiveFacilityRow[];
      if (nctScopeRef.current) {
        const ownSitesInCountry = nctScopeFacilitiesRef.current.filter((f) =>
          countryMatches(f.country, country),
        );
        facilities = filterAnalyzableFacilities(ownSitesInCountry);
        if (facilities.length === 0) {
          const msg =
            ownSitesInCountry.length > 0
              ? `${nctScopeRef.current} discloses site(s) in ${country}, but none had a usable facility name to analyze.`
              : `${nctScopeRef.current} doesn't disclose any site locations in ${country}.`;
          if (!background) setError(msg);
          setCountryErrors((prev) => ({ ...prev, [country]: msg }));
          return null;
        }
      } else {
        const landscape = await fetchLiveTrialLandscape({
          indication: formRef.current.indication,
          country,
          ageGroups: formRef.current.ageGroups,
        });
        const recentFacilities = filterRecentFacilities(landscape.facilities);
        facilities = filterAnalyzableFacilities(recentFacilities);
        if (facilities.length === 0) {
          const msg =
            recentFacilities.length > 0
              ? `Live ClinicalTrials.gov sites were found for "${formRef.current.indication}" in ${country}, but none had a usable facility name to analyze.`
              : `No live ClinicalTrials.gov sites found for "${formRef.current.indication}" in ${country} (within the last 3 years).`;
          if (!background) setError(msg);
          setCountryErrors((prev) => ({ ...prev, [country]: msg }));
          return null;
        }
      }
      if (!background) {
        setOngoingTrialSites(facilities);
        setTopRegion(localTopRegion);
      }

      const res = await streamSiteAnalysis({
        indication: formRef.current.indication,
        phase: formRef.current.phase || undefined,
        sampleSize: formRef.current.sampleSize,
        durationMonths: formRef.current.durationMonths,
        budgetTier: formRef.current.budgetTier || undefined,
        ageGroups: formRef.current.ageGroups,
        region,
        country,
        facilities,
      });
      await consumeStageStream(
        res,
        (payload) => {
          if (!background) {
            setStages((prev) => ({
              ...prev,
              [payload.stage]: {
                status: payload.status,
                detail: payload.detail ?? prev[payload.stage]?.detail ?? null,
                data: payload.data ?? prev[payload.stage]?.data ?? null,
              },
            }));
            if (payload.stage === 8 && payload.llm) setLlmInfo(payload.llm);
          }
          if (payload.stage === 6 && payload.status === "complete") {
            localRisk = payload.data as RiskAssessmentRow[];
            if (!background) setRiskAssessment(localRisk);
          }
          if (payload.stage === 7 && payload.status === "complete") {
            localRanking = payload.data as RankingRow[];
            if (!background) setRanking(localRanking);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            result = payload.data as FinalResult;
            if (!background) setFinalResult(result);
          }
        },
        (message) => {
          if (!background) setError(message);
        },
      );
      if (localRisk && localRanking && result) {
        setAnalysisCache((prev) => ({
          ...prev,
          [country]: {
            riskAssessment: localRisk!,
            ranking: localRanking!,
            finalResult: result!,
            ongoingTrialSites: facilities,
            topRegion: localTopRegion,
            analysisId: result!.analysisId ?? null,
          },
        }));
        setCountryErrors((prev) => {
          if (!(country in prev)) return prev;
          const next = { ...prev };
          delete next[country];
          return next;
        });
      }
      return result;
    } catch (err) {
      const msg = (err as Error).message;
      if (!background) setError(msg);
      setCountryErrors((prev) => ({ ...prev, [country]: msg }));
      return null;
    } finally {
      if (background) {
        setPrefetchingCountries((prev) => {
          const next = new Set(prev);
          next.delete(country);
          return next;
        });
      } else {
        setAnalyzing(false);
      }
    }
  }
 
  const selectedCountries = useMemo(() => {
    if (nctScope) {
      return [
        ...new Set(
          nctScopeFacilities
            .map((f) => f.country)
            .filter((c): c is string => !!c),
        ),
      ];
    }
    return countriesFromRegionKeys(form.regions);
  }, [form.regions, nctScope, nctScopeFacilities]);
 
  function setAnalysisCountry(country: string): void {
    setAnalysisCountryState(country);
    if (!country) return;
    const cached = analysisCache[country];
    if (cached) {
      setRiskAssessment(cached.riskAssessment);
      setRanking(cached.ranking);
      setFinalResult(cached.finalResult);
      setOngoingTrialSites(cached.ongoingTrialSites);
      setTopRegion(cached.topRegion);
      return;
    }
    setRiskAssessment(null);
    setRanking(null);
    setFinalResult(null);
 
    if (prefetchingCountries.has(country)) {
      setPrefetchQueue((prev) =>
        prev.includes(country)
          ? [country, ...prev.filter((c) => c !== country)]
          : prev,
      );
      return;
    }
    analyzeForCountry(country);
  }
 
  useEffect(() => {
    if (!analysisCountryState) return;
    const cached = analysisCache[analysisCountryState];
    if (cached && riskAssessment !== cached.riskAssessment) {
      setRiskAssessment(cached.riskAssessment);
      setRanking(cached.ranking);
      setFinalResult(cached.finalResult);
      setOngoingTrialSites(cached.ongoingTrialSites);
      setTopRegion(cached.topRegion);
    }
  }, [analysisCache, analysisCountryState]);
 
  useEffect(() => {
    if (running) return;
    if (!topRegion) return;
    if (selectedCountries.length === 0) {
      if (analysisCountryState) setAnalysisCountry("");
      return;
    }
    if (!selectedCountries.includes(analysisCountryState)) {
      const preferred = selectedCountries.includes(topRegion.country)
        ? topRegion.country
        : selectedCountries[0];
      setAnalysisCountry(preferred);
    }
  }, [selectedCountries.join("|"), topRegion, running]);
  useEffect(() => {
    if (running) return;
    if (!topRegion || !form.indication || selectedCountries.length <= 1) return;
    const missing = selectedCountries.filter(
      (c) =>
        c !== analysisCountryState &&
        !analysisCache[c] &&
        !prefetchingCountries.has(c),
    );
    if (missing.length === 0) return;
    setPrefetchQueue((prev) => [
      ...prev,
      ...missing.filter((c) => !prev.includes(c)),
    ]);
    setPrefetchingCountries((prev) => {
      const next = new Set(prev);
      missing.forEach((c) => next.add(c));
      return next;
    });
  }, [
    running,
    topRegion,
    form.indication,
    selectedCountries.join("|"),
    analysisCache,
    analysisCountryState,
  ]);
 
  useEffect(() => {
    if (prefetchInFlightRef.current) return;
    if (prefetchQueue.length === 0) return;
    const next = prefetchQueue[0];
    if (analysisCache[next]) {
      setPrefetchQueue((q) => q.filter((c) => c !== next));
      setPrefetchingCountries((prev) => {
        const n = new Set(prev);
        n.delete(next);
        return n;
      });
      return;
    }
    prefetchInFlightRef.current = true;
    analyzeForCountry(next, { background: true }).finally(() => {
      prefetchInFlightRef.current = false;
      setPrefetchQueue((q) => q.filter((c) => c !== next));
    });
  }, [prefetchQueue, analysisCache, analysisCountryState]);
 
  useEffect(() => {
    setAnalysisCache({});
    setPrefetchQueue([]);
    setPrefetchingCountries(new Set());
    setCountryErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.indication]);
 
  const value: PipelineState = {
    meta,
    form,
    setForm,
    regionOptions,
    stages,
    running,
    llmInfo,
    finalResult,
    ranking,
    riskAssessment,
    error,
    notice,
    dismissNotice: () => setNotice(null),
    ongoingTrialSites,
    setOngoingTrialSites,
    analyzing,
    analyzeOngoingTrialSites,
    hasTopRegion: !!topRegion,
    topRegion,
    analyzeForCountry,
    selectedCountries,
    analysisCountry: analysisCountryState,
    setAnalysisCountry,
    analysisCache,
    prefetchingCountries,
    countryErrors,
    completedCount,
    progressPct,
    pipelineDone,
    runningStageLabel,
    workflowStepAvailable,
    nctScope,
    nctScopeFacilities,
    handleSubmit,
    runAnalysis,
    runAnalysisFromNct,
    cancelRun,
    cancelSignal,
    saveLabel,
    setSaveLabel,
    saving,
    saveMessage,
    savedRuns,
    openRun,
    setOpenRun,
    loadingRuns,
    canSave,
    handleSave,
    loadSavedRuns,
    openSavedRun,
    openingRunId,
    openRunError,
  };
 
  return (
    <PipelineContext.Provider value={value}>
      {children}
    </PipelineContext.Provider>
  );
}
 
 