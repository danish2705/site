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

/** The top-scoring region/country Stage 2 resolved — just enough to call
 * /api/site-analysis later (see analyzeOngoingTrialSites below). */
interface TopRegionInfo {
  region: string;
  country: string;
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
  /** Risk Register's own Country picker: fetches a fresh live facility list for `country` itself (same live-trials call Ongoing Trials makes), then sends it straight to Stages 4-8 — the whole "search + analyze" round-trip in one action, so Risk Register/Ranking can be re-run for any country in the trial's selected regions without going through the Ongoing Trials tab at all. */
  /** Runs Stages 4-8 for one country and returns its top recommended site (or null on failure/no-sites) — used by the single-country picker on Risk Register/Ranking/Final Recommendation. */
  analyzeForCountry: (country: string) => Promise<FinalResult | null>;

  completedCount: number;
  progressPct: number;
  pipelineDone: boolean;
  /** Human-readable "Stage N of 8: <label>" for whichever stage is currently running — drives the full-screen loading overlay shown while `running` is true. null when not running. */
  runningStageLabel: string | null;

  /** Availability guard for the guided workflow nav (WorkflowNav) and WizardNextLink — same rules the old 5-step wizardStepAvailable used, just extended to cover the 3 Site Map pages (always available, same as before when they were an always-reachable tab). "Predict Region with AI" is no longer a workflow step — it's a modal opened from the sidebar, not gated by this function. */
  workflowStepAvailable: (step: WorkflowStep) => boolean;

  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.indication) {
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
    // No auto-navigate here anymore — a full-screen loading overlay (see
    // RunAnalysisOverlay, rendered in App.tsx while `running` is true) now
    // covers the screen instead, so there's nothing to navigate away from
    // until the whole pipeline finishes (see the navigate-to-Ongoing-Trials
    // call after the stream completes below).
    let streamFailed = false;
    const abortController = new AbortController();
    runAbortRef.current = abortController;

    try {
      const res = await streamRun(form, abortController.signal);
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
            if (top) setTopRegion({ region: top.region, country: top.country });
          }
          if (payload.stage === 8 && payload.llm) setLlmInfo(payload.llm);
          if (payload.stage === 6 && payload.status === "complete") {
            setRiskAssessment(payload.data as RiskAssessmentRow[]);
            // No forced navigation to the Risk Register page here — the
            // user lands on Site Map (Global) when the run starts and
            // stays wherever they are; the nav bar's "complete" badge and
            // WizardNextLink both surface that this step is now ready
            // without yanking them off whatever page they're looking at.
          }
          if (payload.stage === 7 && payload.status === "complete") {
            setRanking(payload.data as RankingRow[]);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            setFinalResult(payload.data as FinalResult);
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
    setAnalyzing(true);
    setError(null);
    setRanking(null);
    setRiskAssessment(null);
    setFinalResult(null);

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
        facilities: ongoingTrialSites,
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
            setRiskAssessment(payload.data as RiskAssessmentRow[]);
          }
          if (payload.stage === 7 && payload.status === "complete") {
            setRanking(payload.data as RankingRow[]);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            setFinalResult(payload.data as FinalResult);
          }
        },
        (message) => setError(message),
      );
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
   */
  async function analyzeForCountry(country: string): Promise<FinalResult | null> {
    if (!form.indication) {
      setError("Select an indication before analyzing a country.");
      return null;
    }
    // Best-effort region label: reuse whichever region the sidebar's own
    // Region/Country list already associates with this country (falls back
    // to the country name itself — the backend only uses this for
    // display/prevalence lookups, not as a strict key).
    const regionMatch = regionOptions.find((r) => r.country === country);
    const region = regionMatch?.region ?? country;

    setAnalyzing(true);
    setError(null);
    setRanking(null);
    setRiskAssessment(null);
    setFinalResult(null);
    let result: FinalResult | null = null;

    try {
      const landscape = await fetchLiveTrialLandscape({
        indication: form.indication,
        country,
        ageGroups: form.ageGroups,
      });
      const facilities = filterRecentFacilities(landscape.facilities);
      if (facilities.length === 0) {
        setError(
          `No live ClinicalTrials.gov sites found for "${form.indication}" in ${country} (within the last 3 years).`,
        );
        return null;
      }
      setOngoingTrialSites(facilities);
      setTopRegion({ region, country });

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
            setRiskAssessment(payload.data as RiskAssessmentRow[]);
          }
          if (payload.stage === 7 && payload.status === "complete") {
            setRanking(payload.data as RankingRow[]);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            result = payload.data as FinalResult;
            setFinalResult(result);
          }
        },
        (message) => setError(message),
      );
      return result;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setAnalyzing(false);
    }
  }



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
    analyzeForCountry,
    completedCount,
    progressPct,
    pipelineDone,
    runningStageLabel,
    workflowStepAvailable,
    handleSubmit,
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
