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
  ComponentScores,
  RiskAssessmentRow,
  FinalResult,
  StageEventPayload,
  RiskRecord,
  RegionOption,
  RegionPredictionResponse,
  RiskExplanation,
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

// Explains WHY the recommended site holds its Low/Medium/High rating.
// Stage 8 only: the Stage 6 accordion shows each site's raw risk register,
// where the Likelihood / Impact / Overall columns already speak for
// themselves, so repeating the derivation above that table is just noise.
function WhyThisRating({
  explanation,
  onDark = false,
}: {
  explanation: RiskExplanation;
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const e = explanation;

  return (
    <div className={`why-risk ${onDark ? "on-dark" : ""}`}>
      <div className="why-risk-head">
        <span className={`badge ${e.level.toLowerCase()}`}>{e.level}</span>
        <span className="why-risk-rule">{e.rule}</span>
      </div>

      <div className="why-risk-mix">
        <span className="why-risk-stat">
          <strong>{e.totalRecords}</strong> record(s)
        </span>
        <span className="why-risk-stat high">
          <strong>{e.highCount}</strong> High
        </span>
        <span className="why-risk-stat medium">
          <strong>{e.mediumCount}</strong> Medium
        </span>
        <span className="why-risk-stat low">
          <strong>{e.lowCount}</strong> Low
        </span>
        {e.totalRecords > 0 && (
          <span className="why-risk-stat">
            <strong>{e.activeAtLevel}</strong> of {e.driverTotal} deciding
            record(s) still open
          </span>
        )}
      </div>

      {e.drivers.length > 0 && (
        <>
          <button
            type="button"
            className="link-btn"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? "Hide" : "Show"} the {e.level.toLowerCase()} record(s)
            behind this rating
            {e.driverTotal > e.drivers.length &&
              ` (top ${e.drivers.length} of ${e.driverTotal})`}
          </button>
          {open && (
            <ul className="driver-list">
              {e.drivers.map((d) => (
                <li className="driver-item" key={d.riskId}>
                  <div className="driver-top">
                    <span className="driver-id">{d.riskId}</span>
                    <span className="driver-cat">{d.category}</span>
                    <span
                      className={`driver-status ${d.active ? "active" : ""}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="driver-desc">{d.description}</div>
                  {/* The actual derivation: this is what turns "High" from
                      an assertion into something the reader can check. */}
                  <div className="driver-derivation">{d.derivation}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {e.categoryCounts.length > 0 && e.level !== "Low" && (
        <div className="why-risk-cats">
          {e.categoryCounts
            .filter((c) => c.high > 0 || c.medium > 0)
            .map((c) => (
              <span className="chip" key={c.category}>
                {c.category}: {c.high > 0 && `${c.high} high`}
                {c.high > 0 && c.medium > 0 && ", "}
                {c.medium > 0 && `${c.medium} medium`}
              </span>
            ))}
        </div>
      )}
    </div>
  );
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

// Compact per-component bar for a site's weighted score. A component with
// no data renders as a gap with a "no data" title rather than a zero-width
// bar, since those mean very different things: the backend drops an
// unmeasured component and renormalises the remaining weights.
const SCORE_COMPONENTS: {
  key: keyof ComponentScores;
  label: string;
  weight: number;
}[] = [
  { key: "recruitment", label: "Recruitment", weight: 35 },
  { key: "quality", label: "Quality", weight: 25 },
  { key: "retention", label: "Retention", weight: 20 },
  { key: "diversity", label: "Diversity", weight: 10 },
  { key: "cost", label: "Cost", weight: 10 },
];

function ScoreBreakdown({ components }: { components: ComponentScores }) {
  return (
    <div className="score-breakdown">
      {SCORE_COMPONENTS.map(({ key, label, weight }) => {
        const value = components[key];
        return (
          <div
            key={key}
            className="score-component"
            title={
              value === null
                ? `${label} (${weight}%): no data \u2014 excluded, weight redistributed`
                : `${label} (${weight}%): ${value.toFixed(1)}/100`
            }
          >
            <span className="score-component-label">{label.slice(0, 4)}</span>
            <span className="score-component-track">
              {value !== null && (
                <span
                  className="score-component-fill"
                  style={{ width: `${value}%` }}
                />
              )}
            </span>
          </div>
        );
      })}
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

// Standalone "AI Region Prediction" section. Deliberately independent of
// the 8-stage pipeline: the pipeline only *consumes* a region (either one
// the user picked, or the best-fit fallback), whereas this asks the model
// to propose one from the trial requirements alone — and lets the user
// push that answer straight into the Region / Country Selection input.
function AIRegionPrediction({
  form,
  disabled,
  onApply,
}: {
  form: TrialForm;
  disabled: boolean;
  onApply: (region: string, country: string) => void;
}) {
  const [result, setResult] = useState<RegionPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  // A prediction is only meaningful for the indication it was made for, so
  // clear it the moment the user switches indication rather than leaving a
  // stale recommendation on screen next to the new selection.
  useEffect(() => {
    setResult(null);
    setError(null);
    setApplied(null);
    setShowAll(false);
  }, [form.indication]);

  async function predict() {
    setLoading(true);
    setError(null);
    setApplied(null);
    try {
      const res = await fetch("/api/predict-region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indication: form.indication,
          phase: form.phase,
          sampleSize: form.sampleSize,
          durationMonths: form.durationMonths,
          budgetTier: form.budgetTier,
        }),
      });
      const data = (await res.json()) as RegionPredictionResponse & {
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
      // Expand on a fresh result — otherwise clicking Predict while the
      // section is collapsed would appear to do nothing.
      setOpen(true);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const p = result?.prediction;
  const visibleCandidates = showAll
    ? (result?.candidates ?? [])
    : (result?.candidates ?? []).slice(0, 5);

  return (
    <div className={`card predict-card ${open ? "" : "collapsed"}`}>
      <div className="predict-head">
        {/* The toggle holds only phrasing content (spans) — the heading is
            styled to match .card h2 rather than being a real <h2>, since an
            <h2> inside a <button> is invalid HTML. */}
        <button
          type="button"
          className="predict-collapse-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="predict-collapse-caret">{open ? "▾" : "▸"}</span>
          <span className="predict-head-text">
            <span className="tag">AI Prediction</span>
            <span className="predict-title">Predicted Region / Country</span>
            {open ? (
              <span className="section-hint">
                Instead of choosing a region yourself, let the model propose one
                from the trial requirements — then apply it to the form and run
                the pipeline.
              </span>
            ) : (
              // Collapsed: keep the answer itself visible so closing the
              // section hides the supporting detail, not the result.
              <span className="predict-collapsed-summary">
                {result
                  ? `${result.prediction.region}, ${result.prediction.country} · ${result.prediction.confidence} confidence`
                  : "Collapsed — expand to predict a region."}
              </span>
            )}
          </span>
        </button>
        <div className="predict-head-actions">
          {result && open && (
            <span
              className={`llm-badge ${result.llm === "mock" ? "mock" : ""}`}
            >
              {result.llm === "mock"
                ? "Using: mock (no API key)"
                : `Using: ${result.llm}`}
            </span>
          )}
          <button
            type="button"
            className="predict-btn"
            onClick={predict}
            disabled={disabled || loading || !form.indication}
          >
            {loading ? (
              <>
                <span className="spinner" /> Predicting…
              </>
            ) : result ? (
              "Re-predict"
            ) : (
              "Predict Region with AI"
            )}
          </button>
        </div>
      </div>

      {open && (
        <>
          {error && <p className="error-text">{error}</p>}

          {!result && !loading && !error && (
            <p className="predict-placeholder">
              No prediction yet — run it to see a recommended region, why it was
              chosen, and how every viable region scored.
            </p>
          )}
        </>
      )}

      {open && result && p && (
        <>
          <div className="predict-hero">
            <div className="predict-hero-main">
              <div className="predict-hero-label">Recommended region</div>
              <div className="predict-hero-region">
                {p.region}, {p.country}
              </div>
              <div className="predict-hero-meta">
                {result.specialty} sites · {result.indication}
              </div>
            </div>
            <div className="predict-hero-side">
              <span className={`conf-badge conf-${p.confidence.toLowerCase()}`}>
                {p.confidence} confidence
              </span>
              <button
                type="button"
                className="apply-btn"
                onClick={() => {
                  onApply(p.region, p.country);
                  setApplied(`${p.region}||${p.country}`);
                }}
                disabled={applied === `${p.region}||${p.country}`}
              >
                {applied === `${p.region}||${p.country}`
                  ? "✓ Applied to form"
                  : "Use this region"}
              </button>
            </div>
          </div>

          {p.confidenceReason && (
            <p className="conf-reason">
              <strong>Why {p.confidence.toLowerCase()} confidence:</strong>{" "}
              {p.confidenceReason}
            </p>
          )}

          {p.rationale && <p className="predict-rationale">{p.rationale}</p>}

          {p.keyFactors.length > 0 && (
            <div className="predict-block">
              <div className="predict-block-title">Key factors</div>
              <div className="chip-row">
                {p.keyFactors.map((f, i) => (
                  <span className="chip" key={i}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {p.watchOuts.length > 0 && (
            <div className="predict-block">
              <div className="predict-block-title">Watch-outs</div>
              <ul className="watch-list">
                {p.watchOuts.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {p.alternatives.length > 0 && (
            <div className="predict-block">
              <div className="predict-block-title">Alternatives</div>
              <div className="alt-list">
                {p.alternatives.map((a, i) => (
                  <div className="alt-item" key={`${a.region}-${i}`}>
                    <div className="alt-item-main">
                      <div className="alt-item-region">
                        {a.region}, {a.country}
                      </div>
                      <div className="alt-item-why">{a.why}</div>
                    </div>
                    <button
                      type="button"
                      className="apply-btn ghost"
                      onClick={() => {
                        onApply(a.region, a.country);
                        setApplied(`${a.region}||${a.country}`);
                      }}
                      disabled={applied === `${a.region}||${a.country}`}
                    >
                      {applied === `${a.region}||${a.country}`
                        ? "✓ Applied"
                        : "Use"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="predict-block">
            <div className="predict-block-title">
              Scored candidates
              <span className="predict-block-note">
                {result.candidates.length} region(s) with {result.specialty}{" "}
                sites
                {result.excludedNoSites > 0 &&
                  ` · ${result.excludedNoSites} skipped (no ${result.specialty} sites)`}
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Region</th>
                    <th>Score</th>
                    <th>Est. Patients</th>
                    <th>Sites</th>
                    <th>Avg Suitability</th>
                    <th>Approval</th>
                    <th>Competing</th>
                    <th>Cost/Patient</th>
                    <th>Months to Enroll</th>
                    <th>High Risks</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCandidates.map((c, i) => {
                    const isPick =
                      c.region === p.region && c.country === p.country;
                    return (
                      <tr
                        key={`${c.region}||${c.country}`}
                        className={isPick ? "row-pick" : ""}
                      >
                        <td>{i + 1}</td>
                        <td>
                          {c.region}
                          {isPick && <span className="pick-tag">AI pick</span>}
                          <div className="site-id">{c.country}</div>
                        </td>
                        <td>
                          <div className="score-cell">
                            <div className="score-track">
                              <div
                                className="score-fill"
                                style={{ width: `${c.score}%` }}
                              />
                            </div>
                            <span>{c.score}</span>
                          </div>
                        </td>
                        <td>{c.estimatedPatients.toLocaleString()}</td>
                        <td>{c.siteCount}</td>
                        <td>{c.avgSuitability}/100</td>
                        <td>{c.regulatoryWeeks}w</td>
                        <td>{c.competingTrials}</td>
                        <td>${c.avgCostPerPatient.toLocaleString()}</td>
                        <td>
                          {c.monthsToEnroll === null
                            ? "—"
                            : `${c.monthsToEnroll} mo`}
                        </td>
                        <td>{c.highRiskCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {result.candidates.length > 5 && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setShowAll((s) => !s)}
              >
                {showAll
                  ? "Show top 5 only"
                  : `Show all ${result.candidates.length} regions`}
              </button>
            )}
          </div>
        </>
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
                  Optional, multi-select. Leave empty to auto-pick the best-fit
                  region for this indication.
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
          <AIRegionPrediction
            form={form}
            disabled={!meta || running}
            onApply={(region, country) =>
              setForm((f) => ({
                ...f,
                regions: [regionKey(region, country)],
              }))
            }
          />

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
                      <th>Breakdown</th>
                      <th>Protocol fit</th>
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
                        <td>
                          {r.score}/100
                          {/* A score built on partial data shouldn't look
                              identical to one built on a full record. */}
                          {r.confidence !== "High" && (
                            <div
                              className="score-confidence"
                              title={r.caveats.join(" ")}
                            >
                              {r.confidence.toLowerCase()} confidence
                            </div>
                          )}
                        </td>
                        <td>
                          <ScoreBreakdown components={r.components} />
                        </td>
                        <td>
                          {r.meetsRequirements ? (
                            <span className="badge low">Meets all</span>
                          ) : (
                            <span
                              className="badge medium"
                              title={`Fails: ${r.failedCriteria.join(", ")}`}
                            >
                              {r.failedCriteria.length} unmet
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${r.riskLevel.toLowerCase()}`}
                          >
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
                  <div className="k">Site Score</div>
                  {/* Hovering gives the full component derivation, the same
                      way the risk badge explains its level rather than just
                      asserting it. */}
                  <div className="v" title={finalResult.scoreExplanation}>
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
                  <div className="v">{finalResult.riskLevel}</div>
                </div>
              </div>
              {finalResult.riskExplanation && (
                <div className="final-why">
                  <div className="final-why-title">
                    Why this site is rated {finalResult.riskLevel}
                  </div>
                  <WhyThisRating
                    explanation={finalResult.riskExplanation}
                    onDark
                  />
                </div>
              )}
              <p className="final-text">
                <strong>AI Recommendation ({llmInfo}):</strong>{" "}
                {finalResult.text}
              </p>
            </div>
          )}

          {!running && completedCount === 0 && (
            <div className="card empty-state">
              <p>
                Fill in the trial requirements on the left and run the pipeline
                to see Stage 6-8 output here — or use the AI Region Prediction
                section above to get a suggested region first.
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
