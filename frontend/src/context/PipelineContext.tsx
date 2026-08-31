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
} from "../types";
import { STAGE_LIST } from "../constants/pipeline";
import type { WorkflowStep } from "../constants/workflow";
import { fetchMeta } from "../services/meta.service";
import { streamRun, streamSiteAnalysis } from "../services/pipeline.service";
import { fetchLiveTrialLandscape } from "../services/liveTrials.service";
import { createRun, getRun, listRuns } from "../services/runs.service";
import { useRoute } from "./RouteContext";
import { countriesFromRegionKeys } from "../utils/region";

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

  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Runs Stages 1-8 for an explicit form (no submit event needed) — used by the landing page's NCT-lookup auto-fill flow and by the full-page/modal Analysis Parameters forms (ParametersFormPage, EditParametersModal) to run the analysis with no native form submit needed. Call setForm with the same values first so the UI (parameters form, saved-run metadata) reflects what's actually running. */
  runAnalysis: (formToUse: TrialForm) => Promise<void>;
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
  const [form, setForm] = useState<TrialForm>({
    indication: "",
    phase: "",
    sampleSize: "",
    durationMonths: "",
    budgetTier: "",
    regions: [],
    ageGroups: [],
  });
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

  /**
   * Risk Register's Country dropdown: fetches a fresh live facility list for
   * this specific country (the same /api/live-trials call Ongoing Trials
   * makes) and immediately sends it on to Stages 4-8, all in one action —
   * so picking a different country directly on Risk Register re-runs the
   * whole "find sites -> analyze them" round-trip for that country, without
   * needing to visit Ongoing Trials first. Also updates ongoingTrialSites/
   * topRegion so the two stay in sync if the user does visit that tab next.
   *
   * `opts.background` runs this as a silent prefetch (see the auto-prefetch
   * effect below): it still fills analysisCache for `country`, but never
   * touches the error banner, `analyzing`, or the currently-displayed
   * riskAssessment/ranking/finalResult — those stay whatever the
   * currently-selected country's data is until the user actually switches
   * to this one (at which point analysisCache already has it ready).
   */
  async function analyzeForCountry(
    country: string,
    opts?: { background?: boolean },
  ): Promise<FinalResult | null> {
    const background = !!opts?.background;
    if (!form.indication) {
      if (!background) setError("Select an indication before analyzing a country.");
      return null;
    }
    // Best-effort region label: reuse whichever region the sidebar's own
    // Region/Country list already associates with this country (falls back
    // to the country name itself — the backend only uses this for
    // display/prevalence lookups, not as a strict key).
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
      const landscape = await fetchLiveTrialLandscape({
        indication: form.indication,
        country,
        ageGroups: form.ageGroups,
      });
      const recentFacilities = filterRecentFacilities(landscape.facilities);
      const facilities = filterAnalyzableFacilities(recentFacilities);
      if (facilities.length === 0) {
        const msg =
          recentFacilities.length > 0
            ? `Live ClinicalTrials.gov sites were found for "${form.indication}" in ${country}, but none had a usable facility name to analyze.`
            : `No live ClinicalTrials.gov sites found for "${form.indication}" in ${country} (within the last 3 years).`;
        if (!background) setError(msg);
        setCountryErrors((prev) => ({ ...prev, [country]: msg }));
        return null;
      }
      if (!background) {
        setOngoingTrialSites(facilities);
        setTopRegion(localTopRegion);
      }

      const res = await streamSiteAnalysis({
        indication: form.indication,
        phase: form.phase || undefined,
        sampleSize: form.sampleSize,
        durationMonths: form.durationMonths,
        budgetTier: form.budgetTier || undefined,
        ageGroups: form.ageGroups,
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
      // Cache the full result regardless of foreground/background — this is
      // what lets switching back to this country later (or a background
      // prefetch that finishes after the fact) show data instantly with no
      // re-fetch. Only cache complete results — a stream that errored out
      // partway shouldn't be remembered as "analyzed."
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

  const selectedCountries = useMemo(
    () => countriesFromRegionKeys(form.regions),
    [form.regions],
  );

  /**
   * Switches which country Risk Register/Ranking/Final Recommendation show.
   * A cache hit swaps the active riskAssessment/ranking/finalResult in with
   * no network call; a miss falls through to analyzeForCountry (unless a
   * background prefetch for it is already in flight, in which case the
   * cache-sync effect below picks the result up as soon as that finishes).
   */
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
    // Already queued or actively being fetched in the background — the
    // cache-sync effect above will pick up the result the moment it lands,
    // no need to start a second fetch for it. If it's still just waiting in
    // line (not the one currently in flight), bump it to the front so the
    // drain effect processes it next — the user is looking at this country
    // right now, it shouldn't sit behind whatever else happened to queue
    // ahead of it.
    // Not cached yet — whatever's currently displayed belongs to whichever
    // country was selected before (or nothing, on the very first pick).
    // Clear it now rather than leaving the previous country's table on
    // screen: the panels only show their loading spinner when there's no
    // data displayed, so without this a switch to a still-loading country
    // silently kept showing the old country's rows with just the dropdown
    // label reading "(analyzing…)" — no visible loading state at all.
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

  // Keeps the active riskAssessment/ranking/finalResult synced with
  // whichever country is currently selected, whenever analysisCache
  // changes — covers the case where a background prefetch for the
  // currently-selected country finishes after setAnalysisCountry already
  // deferred to it (see the `prefetchingCountries.has(country)` guard
  // above), so the page updates the moment that data is ready instead of
  // requiring another pick.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisCache, analysisCountryState]);

  // Defaults the shown country whenever the selected region "set" changes —
  // and, unlike the old per-page effect this replaces, actually resolves
  // data for it (via setAnalysisCountry) instead of just picking a label to
  // display. Prefers topRegion.country when it's part of the set, since
  // that's the one Run Analysis already analyzed for free at Stage 2 —
  // otherwise falls back to the first selected country, same as before.
  //
  // Gated on `topRegion` (i.e. Run Analysis has actually completed once):
  // checking a box in Step 1's Region/Country list changes `selectedCountries`
  // immediately, long before the user has finished the form or clicked "Run
  // Analysis" — without this gate, that alone would kick off a live
  // Stages-4-8 analysis (ClinicalTrials.gov + LLM calls) the moment a
  // checkbox is ticked, and unlock/populate Risk Register, Ranking, and
  // Final Recommendation before the user ever asked for a run.
  useEffect(() => {
    // While the initial Run Analysis stream is still going, handleSubmit
    // itself is already driving topRegion/riskAssessment/ranking/
    // finalResult and will seed analysisCountryState + analysisCache the
    // moment Stage 8 completes — this effect firing mid-stream (topRegion
    // is set as early as Stage 2, well before that) would kick off a
    // second, redundant analyzeForCountry() race against the run still in
    // flight. Wait for it to finish; analysisCountryState will already
    // match by then, so the check below is a no-op rather than a fetch.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountries.join("|"), topRegion, running]);

  // Queues every selected country other than the one currently shown (and
  // not already cached/in-flight) for a silent background analysis — this
  // is what makes switching to ANY country in the set instant rather than
  // just the default one. One at a time (not all at once): each call is a
  // full Stages 4-8 run against live ClinicalTrials.gov + the LLM, and
  // firing them all concurrently would just queue up behind the same rate
  // limits with no benefit.
  //
  // Same `topRegion` gate as above and for the same reason — this must not
  // start firing off live analyses for an entire selected region set before
  // Run Analysis has ever been clicked.
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
    // Marked pending immediately (not only once analyzeForCountry actually
    // starts fetching it) so `prefetchingCountries` means "queued or in
    // flight" — the panels use it to show a loading state the instant a
    // country is picked, rather than only once its turn in the queue
    // arrives.
    setPrefetchingCountries((prev) => {
      const next = new Set(prev);
      missing.forEach((c) => next.add(c));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    running,
    topRegion,
    form.indication,
    selectedCountries.join("|"),
    analysisCache,
    analysisCountryState,
  ]);

  // Drains prefetchQueue one country at a time. Deliberately does NOT skip
  // `next` just because it happens to equal the currently-selected country:
  // setAnalysisCountry bumps a still-queued country to the front instead of
  // removing it when the user switches to it mid-queue (see above), so
  // "queued" and "currently selected" are no longer mutually exclusive —
  // this needs to actually run for it, not drop it silently (which would
  // otherwise leave it stuck in prefetchingCountries forever, showing an
  // endless loading state that never resolves).
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchQueue, analysisCache, analysisCountryState]);

  // A fresh indication means a fresh region list and stale analyses for the
  // old one — drop the cache and prefetch queue so a re-selected country
  // name from a different indication can't serve mismatched cached data.
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
    handleSubmit,
    runAnalysis,
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
