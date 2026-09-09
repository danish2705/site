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

function filterAnalyzableFacilities(
  facilities: LiveFacilityRow[],
): LiveFacilityRow[] {
  return facilities.filter(
    (f) => typeof f.facility === "string" && f.facility.trim().length > 0,
  );
}

interface TopRegionInfo {
  region: string;
  country: string;
}

interface CountryAnalysis {
  riskAssessment: RiskAssessmentRow[];
  ranking: RankingRow[];
  finalResult: FinalResult;
  ongoingTrialSites: LiveFacilityRow[];
  topRegion: TopRegionInfo;
  analysisId: string | null;
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
  notice: string | null;
  dismissNotice: () => void;
 
  ongoingTrialSites: LiveFacilityRow[] | null;
  setOngoingTrialSites: (sites: LiveFacilityRow[]) => void;
  analyzing: boolean;
  analyzeOngoingTrialSites: () => Promise<void>;
  hasTopRegion: boolean;
  topRegion: TopRegionInfo | null;
  analyzeForCountry: (
    country: string,
    opts?: { background?: boolean },
  ) => Promise<FinalResult | null>;

  selectedCountries: string[];
  analysisCountry: string;
  setAnalysisCountry: (country: string) => void;
  analysisCache: Record<string, CountryAnalysis>;
  prefetchingCountries: Set<string>;
  countryErrors: Record<string, string>;
 
  completedCount: number;
  progressPct: number;
  pipelineDone: boolean;
  runningStageLabel: string | null;
   workflowStepAvailable: (step: WorkflowStep) => boolean;
  nctScope: string | null;
  nctScopeFacilities: LiveFacilityRow[];

  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  runAnalysis: (formToUse: TrialForm) => Promise<void>;
  runAnalysisFromNct: (
    lookup: NctLookupResponse,
    formToUse: TrialForm,
  ) => Promise<void>;
  cancelRun: () => void;
  cancelSignal: number;
 
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
  const [prefetchQueue, setPrefetchQueue] = useState<string[]>([]);
  const prefetchInFlightRef = useRef(false);
  const { setRoute } = useRoute();
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
    if (
      step === "site-map-global" ||
      step === "site-map-details" ||
      step === "site-combination"
    ) {
      return !!topRegion || running || analyzing;
    }
    if (step === "competing") return !!topRegion || running || analyzing;
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
  const regionOptions = useMemo(() => meta?.regionOptions ?? [], [meta]);

  async function runAnalysis(formToUse: TrialForm) {
    if (!formToUse.indication) {
      setError("Please select an indication before running the analysis.");
      return;
    }
    applyNctScope(null, []);
    setStages(emptyStages());
    setFinalResult(null);
    setRanking(null);
    setRiskAssessment(null);
    setLlmInfo(null);
    setError(null);
    setRunning(true);
    setAnalysisCache({});
    setPrefetchQueue([]);
    setPrefetchingCountries(new Set());
    setCountryErrors({});
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
          }
          if (payload.stage === 7 && payload.status === "complete") {
            runRanking = payload.data as RankingRow[];
            setRanking(runRanking);
          }
          if (payload.stage === 8 && payload.status === "complete") {
            const finalRes = payload.data as FinalResult;
            setFinalResult(finalRes);
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
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setRunning(false);
      runAbortRef.current = null;
      if (!streamFailed) setRoute("competing");
    }
  }
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

    const primaryCountry = [...countryCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];
    const primaryResult = await analyzeForCountry(primaryCountry);
    if (primaryResult) setAnalysisCountryState(primaryCountry);
    setRoute("competing");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runAnalysis(form);
  }
 
  function cancelRun(): void {
    if (!runAbortRef.current) return;
    runAbortRef.current.abort();
    setCancelSignal((n) => n + 1);
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
 
 