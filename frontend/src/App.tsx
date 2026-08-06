import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import "./App.css";
import type {
  TrialForm,
  MetaResponse,
  StagesMap,
  RankingRow,
  RiskAssessmentRow,
  FinalResult,
  StageEventPayload,
  RiskRecord,
  RegionOption,
} from "./types";

// Composite key used by the Region / Country Selection dropdown, so each
// checkbox option value uniquely identifies a (Region, Country) pair.
const regionKey = (region: string, country: string) => `${region}||${country}`;

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

// Renders individual Risk_Register entries as records (one row per risk)
// rather than folding them into a single aggregate count/badge.
function RiskRegisterTable({ records }: { records: RiskRecord[] }) {
  if (records.length === 0) {
    return <p className="mini-card-detail">No risk records for this site.</p>;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Risk ID</th>
            <th>Category</th>
            <th>Description</th>
            <th>Likelihood</th>
            <th>Impact</th>
            <th>Overall</th>
            <th>Status</th>
            <th>Mitigation Plan</th>
            <th>Owner</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.riskId}>
              <td>{r.riskId}</td>
              <td>{r.category}</td>
              <td className="col-wide">{r.description}</td>
              <td>
                <span className={`badge ${r.likelihood.toLowerCase()}`}>
                  {r.likelihood}
                </span>
              </td>
              <td>
                <span className={`badge ${r.impact.toLowerCase()}`}>
                  {r.impact}
                </span>
              </td>
              <td>
                <span className={`badge ${r.overallRisk.toLowerCase()}`}>
                  {r.overallRisk}
                </span>
              </td>
              <td>{r.status}</td>
              <td className="col-wide">{r.mitigationPlan}</td>
              <td>{r.owner}</td>
              <td>{r.riskScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stage 6 output: an accordion of every candidate site (before ranking
// narrows to the top 10), each expandable to its full risk register.
function RiskAssessmentAccordion({
  rows,
  recommendedSiteId,
}: {
  rows: RiskAssessmentRow[];
  recommendedSiteId?: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    recommendedSiteId ?? null,
  );

  // The recommended site is only known once Stage 8 finishes, well after
  // this accordion first mounts from Stage 6's output — auto-expand it the
  // moment it becomes available instead of only honoring it at mount time.
  useEffect(() => {
    if (recommendedSiteId) setExpanded(recommendedSiteId);
  }, [recommendedSiteId]);

  return (
    <div className="risk-accordion">
      {rows.map((r) => {
        const isOpen = expanded === r.siteId;
        return (
          <div
            className={`risk-accordion-item ${isOpen ? "open" : ""}`}
            key={r.siteId}
          >
            <button
              type="button"
              className="risk-accordion-header"
              onClick={() => setExpanded(isOpen ? null : r.siteId)}
              aria-expanded={isOpen}
            >
              <span className="risk-accordion-site">
                <span className="risk-accordion-site-name">{r.siteName}</span>
                <span className="site-id">{r.siteId}</span>
              </span>
              <span className="risk-accordion-region">{r.region}</span>
              <span className="risk-accordion-badge-col">
                <span className={`badge ${r.overallRisk.toLowerCase()}`}>
                  {r.overallRisk}
                </span>
              </span>
              <span className="risk-accordion-counts">
                {r.highRiskCount} high · {r.mediumRiskCount} medium
              </span>
              <span className="risk-accordion-caret">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="risk-accordion-body">
                <RiskRegisterTable records={r.riskRecords} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Closed-by-default dropdown with checkboxes for multi-selecting
// Region/Country combinations (native <select multiple> shows an
// always-open listbox, which isn't what a "dropdown" should look like).
function RegionDropdown({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: RegionOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Close (and never stay stuck open) whenever the option list changes,
  // e.g. because the indication changed underneath the dropdown.
  useEffect(() => {
    setOpen(false);
  }, [options]);

  function toggleOption(key: string) {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key]);
  }

  function stop(e: ReactMouseEvent) {
    e.stopPropagation();
  }

  const label =
    selected.length === 0
      ? "Auto-select best region"
      : selected.length === 1
        ? (() => {
            const [region, country] = selected[0].split("||");
            return `${region} — ${country}`;
          })()
        : `${selected.length} regions selected`;

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className="dropdown-toggle"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="dropdown-toggle-label">{label}</span>
        <span className="dropdown-caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="dropdown-panel">
          {options.length === 0 ? (
            <div className="dropdown-empty">
              No region/country options for this indication.
            </div>
          ) : (
            <>
              <div className="dropdown-actions" onClick={stop}>
                <button
                  type="button"
                  onClick={() =>
                    onChange(options.map((o) => regionKey(o.region, o.country)))
                  }
                >
                  Select all
                </button>
                <button type="button" onClick={() => onChange([])}>
                  Clear
                </button>
              </div>
              <div className="dropdown-options">
                {options.map((o) => {
                  const key = regionKey(o.region, o.country);
                  return (
                    <label key={key} className="dropdown-option">
                      <input
                        type="checkbox"
                        checked={selected.includes(key)}
                        onChange={() => toggleOption(key)}
                      />
                      {o.region} — {o.country}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [form, setForm] = useState<TrialForm>({
    indication: "",
    phase: "Phase II",
    sampleSize: 300,
    durationMonths: 18,
    budgetTier: "Mid",
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

  // Region/Country options depend on the selected indication (Region_Data
  // has different rows per indication), so filter meta's full option list
  // down to the ones relevant right now. Memoized so the array reference
  // only changes when meta or the indication actually changes — otherwise
  // RegionDropdown's "close on option-list change" effect would fire (and
  // snap the dropdown shut) on every unrelated re-render, e.g. while SSE
  // progress events are streaming in.
  const regionOptions = useMemo(
    () =>
      (meta?.regionOptions ?? []).filter(
        (o) => o.indication === form.indication,
      ),
    [meta, form.indication],
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStages(emptyStages());
    setFinalResult(null);
    setRanking(null);
    setRiskAssessment(null);
    setLlmInfo(null);
    setError(null);
    setRunning(true);

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
            }
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

      <div className="layout">
        <aside className="sidebar">
          <form className="card form-card" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Indication
                <select
                  value={form.indication}
                  onChange={(e) =>
                    // Changing indication invalidates any previously
                    // selected region/country options, since they're
                    // indication-specific.
                    setForm({
                      ...form,
                      indication: e.target.value,
                      regions: [],
                    })
                  }
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
                Region / Country Selection
                <RegionDropdown
                  options={regionOptions}
                  selected={form.regions}
                  onChange={(regions) => setForm({ ...form, regions })}
                  disabled={!meta}
                />
                <span className="field-hint">
                  Optional, multi-select. Leave empty to auto-pick the
                  best-fit region for this indication.
                </span>
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
                  onChange={(e) =>
                    setForm({ ...form, budgetTier: e.target.value })
                  }
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
        </aside>

        <main className="results">
          {(running || completedCount > 0) && (
            <div className="card">
              <div className="progress-header">
                <span className="tag">Pipeline Progress</span>
                {llmInfo && (
                  <span
                    className={`llm-badge ${llmInfo === "mock" ? "mock" : ""}`}
                  >
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
                        {s.n < STAGE_LIST.length && (
                          <div className="connector" />
                        )}
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

          {riskAssessment && (
            <div className="card">
              <span className="tag">Stage 6 Output</span>
              <h2>AI Risk Assessment</h2>
              <p className="section-hint">
                Every candidate site's risk register, as individual records —
                expand a site to see them. Click a site to expand/collapse.
              </p>
              <RiskAssessmentAccordion
                rows={riskAssessment}
                recommendedSiteId={finalResult?.siteId}
              />
            </div>
          )}

          {ranking && (
            <div className="card">
              <span className="tag">Stage 7 Output</span>
              <h2>Site Ranking</h2>
              <div className="table-scroll">
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
            </div>
          )}

          {finalResult && (
            <div className="final-summary">
              <span className="tag tag-on-dark">Stage 8 Output</span>
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
                <strong>AI Recommendation ({llmInfo}):</strong>{" "}
                {finalResult.text}
              </p>
            </div>
          )}

          {!running && completedCount === 0 && (
            <div className="card empty-state">
              <p>
                Fill in the trial requirements on the left and run the
                pipeline to see Stage 6-8 output here.
              </p>
            </div>
          )}
        </main>
      </div>

      <footer>
        AI Clinical Trial Site Selection POC — reads backend/data/*.xlsx,
        GPT-4.1 for Stage 8
      </footer>
    </div>
  );
}
