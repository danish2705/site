import {
  createContext,
  useEffect,
  useMemo,
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
import { createRun, getRun, listRuns } from "../services/runs.service";
import { useRoute } from "./RouteContext";

interface TopRegionInfo {
  region: string;
  country: string;
}

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

  ongoingTrialSites: LiveFacilityRow[] | null;
  setOngoingTrialSites: (sites: LiveFacilityRow[]) => void;
  analyzing: boolean;
  analyzeOngoingTrialSites: () => Promise<void>;
  hasTopRegion: boolean;

  completedCount: number;
  progressPct: number;
  pipelineDone: boolean;

  workflowStepAvailable: (step: WorkflowStep) => boolean;

  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;

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
  const [ongoingTrialSites, setOngoingTrialSites] = useState<
    LiveFacilityRow[] | null
  >(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [topRegion, setTopRegion] = useState<TopRegionInfo | null>(null);
  const { setRoute } = useRoute();

  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<SavedRunSummary[] | null>(null);
  const [openRun, setOpenRun] = useState<SavedRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [openingRunId, setOpeningRunId] = useState<string | null>(null);
  const [openRunError, setOpenRunError] = useState<string | null>(null);

  const canSave = !running && !!ranking && ranking.length > 0;

  function workflowStepAvailable(step: WorkflowStep): boolean {
    if (
      step === "site-map-details" ||
      step === "site-combination"
    ) {
      return true;
    }
    if (step === "competing") return !!topRegion || running || analyzing;
    if (step === "risk") return !!riskAssessment || running || analyzing;
    if (step === "ranking") return !!ranking || running || analyzing;
    return !!finalResult || running || analyzing;
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
        if (data.metaWarning) setError(data.metaWarning);
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
    
    setRoute("site-map-details");

    try {
      const res = await streamRun(form);
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
            const top = (payload.data as { region: string; country: string }[])?.[0];
            if (top) setTopRegion({ region: top.region, country: top.country });
          }
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
      setRunning(false);
    }
  }

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
    ongoingTrialSites,
    setOngoingTrialSites,
    analyzing,
    analyzeOngoingTrialSites,
    hasTopRegion: !!topRegion,
    completedCount,
    progressPct,
    pipelineDone,
    workflowStepAvailable,
    handleSubmit,
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