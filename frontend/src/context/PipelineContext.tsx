import {
  createContext,
  useContext,
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
} from "../types";

// Composite key used by the Region / Country Selection input, so each
// checkbox option value uniquely identifies a (Region, Country) pair.
export const regionKey = (region: string, country: string) =>
  `${region}||${country}`;

export const STAGE_LIST: { n: number; label: string }[] = [
  { n: 1, label: "Clinical Trial Requirements" },
  { n: 2, label: "Region / Country Selection" },
  { n: 3, label: "Patient Population Analysis" },
  { n: 4, label: "Candidate Site Identification" },
  { n: 5, label: "Site Evaluation" },
  { n: 6, label: "AI Risk Assessment" },
  { n: 7, label: "Site Ranking" },
  { n: 8, label: "Final Recommendation" },
];

function emptyStages(): StagesMap {
  const obj: StagesMap = {};
  for (const s of STAGE_LIST)
    obj[s.n] = { status: "pending", detail: null, data: null };
  return obj;
}

// ---- Results wizard --------------------------------------------------
// The right-hand panel shows exactly one result at a time rather than
// stacking every section on one long page: it starts on the AI region
// prediction, then swaps in place to Risk Assessment the moment a run
// finishes, and the user clicks "Next" to move on to Site Ranking and
// finally the Recommendation (+ Save). The left-hand form stays fixed
// throughout — only this panel changes.
export type WizardStep = "predict" | "risk" | "ranking" | "recommendation";

export const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: "predict", label: "AI Prediction" },
  { key: "risk", label: "Risk Assessment" },
  { key: "ranking", label: "Site Ranking" },
  { key: "recommendation", label: "Recommendation" },
];

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

  completedCount: number;
  progressPct: number;
  pipelineDone: boolean;

  wizardStep: WizardStep;
  setWizardStep: (step: WizardStep) => void;
  wizardStepAvailable: (step: WizardStep) => boolean;

  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;

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
}

const PipelineContext = createContext<PipelineState | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  // Every field starts unset — the user must explicitly choose each one
  // rather than the form arriving pre-filled with a default value.
  const [form, setForm] = useState<TrialForm>({
    indication: "",
    phase: "",
    sampleSize: "",
    durationMonths: "",
    budgetTier: "",
    regions: [],
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
  const [wizardStep, setWizardStep] = useState<WizardStep>("predict");

  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<SavedRunSummary[] | null>(null);
  const [openRun, setOpenRun] = useState<SavedRunDetail | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const canSave = !running && !!ranking && ranking.length > 0;

  function wizardStepAvailable(step: WizardStep): boolean {
    if (step === "predict") return true;
    if (step === "risk") return !!riskAssessment;
    if (step === "ranking") return !!ranking;
    return !!finalResult;
  }

  async function handleSave(): Promise<boolean> {
    if (!canSave || !ranking) return false;
    setSaving(true);
    setSaveMessage(null);
    try {
      // Stage 1's data carries the values the pipeline actually resolved to
      // (form value if the user picked one, else the indication's own
      // Trial_Requirements default) — prefer that over the raw form so a
      // field the user left blank doesn't get saved as blank.
      const stage1Data = stages[1]?.data as {
        phase?: string;
        targetSampleSize?: number;
        durationMonths?: number;
        budgetTier?: string;
      } | null;
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
      setSaveLabel("");
      setSaveMessage("Saved.");
      // Refresh the list so the new run is visible without a reload.
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
      const res = await fetch("/api/runs");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Could not load saved runs`);
      setSavedRuns(body as SavedRunSummary[]);
    } catch (err) {
      setSaveMessage((err as Error).message);
      setSavedRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }

  async function openSavedRun(id: string) {
    try {
      const res = await fetch(`/api/runs/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not open run");
      setOpenRun(body as SavedRunDetail);
    } catch (err) {
      setSaveMessage((err as Error).message);
    }
  }

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json() as Promise<MetaResponse>)
      .then((data) => {
        // Just populate the dropdown options — do NOT auto-select the first
        // indication. The user has to make an explicit choice.
        setMeta(data);
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

  // Region/Country options depend on the selected indication (Region_Data
  // has different rows per indication), so filter meta's full option list
  // down to the ones relevant right now. Memoized so the array reference
  // only changes when meta or the indication actually changes.
  const regionOptions = useMemo(
    () =>
      (meta?.regionOptions ?? []).filter(
        (o) => o.indication === form.indication,
      ),
    [meta, form.indication],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Indication is the one field the backend can't default on its own —
    // everything else (phase, sample size, duration, budget tier) falls
    // back to that indication's Trial_Requirements row when left blank.
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
    // Show the AI-prediction slot again while the new run streams in — the
    // panel switches to Risk Assessment on its own once Stage 6 lands.
    setWizardStep("predict");

    let succeeded = true;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Expand composite "Region||Country" keys back into
          // {region, country} objects for the backend.
          regions: form.regions.map((key) => {
            const [region, country] = key.split("||");
            return { region, country };
          }),
        }),
      });
      if (!res.body)
        throw new Error("Streaming not supported by this browser/response.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? ""; // keep the last, possibly incomplete chunk for next read

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

          if (eventName === "stage") {
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
              // The one auto-advance: the moment Risk Assessment lands, swap
              // the panel over from AI Prediction without waiting for the
              // rest of the pipeline. From here on the user clicks Next.
              setWizardStep("risk");
            }
            if (payload.stage === 7 && payload.status === "complete") {
              setRanking(payload.data as RankingRow[]);
            }
            if (payload.stage === 8 && payload.status === "complete") {
              setFinalResult(payload.data as FinalResult);
            }
          } else if (eventName === "error") {
            setError(payload.message ?? "Unknown error");
            succeeded = false;
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
      succeeded = false;
    } finally {
      setRunning(false);
      if (!succeeded) setWizardStep("predict");
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
    completedCount,
    progressPct,
    pipelineDone,
    wizardStep,
    setWizardStep,
    wizardStepAvailable,
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
  };

  return (
    <PipelineContext.Provider value={value}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline(): PipelineState {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error("usePipeline() must be used within a PipelineProvider");
  }
  return ctx;
}
