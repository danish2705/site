import { useEffect, useState, type FormEvent } from "react";
import "./App.css";
import type {
  TrialForm,
  MetaResponse,
  StagesMap,
  RankingRow,
  FinalResult,
  StageEventPayload,
} from "./types";

const STAGE_LIST: { n: number; label: string }[] = [
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

export default function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [form, setForm] = useState<TrialForm>({
    indication: "",
    phase: "Phase II",
    sampleSize: 300,
    durationMonths: 18,
    budgetTier: "Mid",
  });
  const [stages, setStages] = useState<StagesMap>(emptyStages());
  const [running, setRunning] = useState(false);
  const [llmInfo, setLlmInfo] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [ranking, setRanking] = useState<RankingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json() as Promise<MetaResponse>)
      .then((data) => {
        setMeta(data);
        if (data.indications?.length) {
          setForm((f) => ({ ...f, indication: data.indications[0] }));
        }
      })
      .catch((err: Error) =>
        setError(`Could not reach backend: ${err.message}`),
      );
  }, []);

  const completedCount = Object.values(stages).filter(
    (s) => s.status === "complete",
  ).length;
  const progressPct = Math.round((completedCount / STAGE_LIST.length) * 100);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStages(emptyStages());
    setFinalResult(null);
    setRanking(null);
    setLlmInfo(null);
    setError(null);
    setRunning(true);

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
            if (payload.stage === 7 && payload.status === "complete") {
              setRanking(payload.data as RankingRow[]);
            }
            if (payload.stage === 8 && payload.status === "complete") {
              setFinalResult(payload.data as FinalResult);
            }
          } else if (eventName === "error") {
            setError(payload.message ?? "Unknown error");
          }
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="wrap">
      <header>
        <h1>
          AI-Driven Clinical Trial Site Intelligence &amp; Risk Assessment
        </h1>
        <p>
          Live run of the 8-stage pipeline against the synthetic dataset in
          backend/data.
        </p>
      </header>

      <form className="card form-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Indication
            <select
              value={form.indication}
              onChange={(e) => setForm({ ...form, indication: e.target.value })}
              disabled={!meta}
            >
              {(meta?.indications ?? []).map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phase
            <select
              value={form.phase}
              onChange={(e) => setForm({ ...form, phase: e.target.value })}
            >
              {["Phase I", "Phase II", "Phase III", "Phase IV"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target Sample Size
            <input
              type="number"
              min={10}
              value={form.sampleSize}
              onChange={(e) =>
                setForm({ ...form, sampleSize: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Duration (months)
            <input
              type="number"
              min={1}
              value={form.durationMonths}
              onChange={(e) =>
                setForm({ ...form, durationMonths: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Budget Tier
            <select
              value={form.budgetTier}
              onChange={(e) => setForm({ ...form, budgetTier: e.target.value })}
            >
              {["Low", "Mid", "High"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={running || !meta}>
          {running ? "Running…" : "Run Site Selection Pipeline"}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>

      {(running || completedCount > 0) && (
        <div className="card">
          <div className="progress-header">
            <span className="tag">Pipeline Progress</span>
            {llmInfo && (
              <span className={`llm-badge ${llmInfo === "mock" ? "mock" : ""}`}>
                {llmInfo === "mock"
                  ? "Using: mock (no API key)"
                  : `Using: ${llmInfo}`}
              </span>
            )}
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="progress-pct">{progressPct}% complete</div>

          <div className="flow">
            {STAGE_LIST.map((s) => {
              const st = stages[s.n];
              return (
                <div className="stage" key={s.n}>
                  <div className="rail">
                    <div className={`dot ${st.status}`}>
                      {st.status === "complete" ? "✓" : s.n}
                    </div>
                    {s.n < STAGE_LIST.length && <div className="connector" />}
                  </div>
                  <div className={`mini-card ${st.status}`}>
                    <div className="mini-card-title">
                      {s.label}
                      {st.status === "in-progress" && (
                        <span className="spinner" />
                      )}
                    </div>
                    {st.detail && (
                      <div className="mini-card-detail">{st.detail}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ranking && (
        <div className="card">
          <span className="tag">Stage 7 Output</span>
          <h2>Site Ranking</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Site</th>
                <th>Region</th>
                <th>Score</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.siteId}>
                  <td>{r.rank}</td>
                  <td>
                    {r.siteName}
                    <div className="site-id">{r.siteId}</div>
                  </td>
                  <td>{r.region}</td>
                  <td>{r.suitabilityScore}/100</td>
                  <td>
                    <span className={`badge ${r.riskLevel.toLowerCase()}`}>
                      {r.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {finalResult && (
        <div className="final-summary">
          <h2>Final Recommendation</h2>
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
              <div className="k">Suitability Score</div>
              <div className="v">{finalResult.suitabilityScore}/100</div>
            </div>
            <div className="item">
              <div className="k">Risk Level</div>
              <div className="v">{finalResult.riskLevel}</div>
            </div>
          </div>
          <p className="final-text">
            <strong>AI Recommendation ({llmInfo}):</strong> {finalResult.text}
          </p>
        </div>
      )}

      <footer>
        AI Clinical Trial Site Selection POC — reads backend/data/*.xlsx,
        GPT-4.1 for Stage 8
      </footer>
    </div>
  );
}
