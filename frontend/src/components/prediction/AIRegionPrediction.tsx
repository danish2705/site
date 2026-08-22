import { useEffect, useRef, useState } from "react";
import type { TrialForm, RegionPredictionResponse } from "../../types";
import { predictRegion } from "../../services/region.service";

export default function AIRegionPrediction({
  form,
  disabled,
  onApply,
  autoPredict = false,
}: {
  form: TrialForm;
  disabled: boolean;
  onApply: (region: string, country: string) => void;
  /** Kick off a prediction as soon as this mounts (once), instead of
   * waiting for the user to click "Predict Region with AI" a second time
   * inside the modal — used by PredictRegionModal, since opening the modal
   * already IS the "predict" action from the user's point of view. */
  autoPredict?: boolean;
}) {
  const [result, setResult] = useState<RegionPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
    setApplied(null);
    setShowAll(false);
  }, [form.indication]);

  const autoPredictedRef = useRef(false);
  useEffect(() => {
    if (
      autoPredict &&
      !autoPredictedRef.current &&
      !disabled &&
      form.indication
    ) {
      autoPredictedRef.current = true;
      predict();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPredict, disabled, form.indication]);

  async function predict() {
    setLoading(true);
    setError(null);
    setApplied(null);
    try {
      const data = await predictRegion({
        indication: form.indication,
        phase: form.phase,
        sampleSize: form.sampleSize,
        durationMonths: form.durationMonths,
        budgetTier: form.budgetTier,
      });
      setResult(data);
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
    <div className="predict-card-content">
      <div className="predict-head">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="predict-title">Predicted Region / Country</span>
          </div>
          <div className="predict-head-actions">
            {result && (
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
        <p className="section-hint">
          Instead of choosing a region yourself, let the model propose one from
          the trial requirements — then apply it to the form and run the
          pipeline.
        </p>
      </div>

      <div className="card-scroll-body">
        {error && <p className="error-text">{error}</p>}

        {!result && !loading && !error && (
          <p className="predict-placeholder">
            No prediction yet — run it to see a recommended region, why it was
            chosen, and how every viable region scored.
          </p>
        )}

        {result && p && (
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
                <span
                  className={`conf-badge conf-${p.confidence.toLowerCase()}`}
                >
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
                            {isPick && (
                              <span className="pick-tag">AI pick</span>
                            )}
                            <div className="site-id">{c.country}</div>
                          </td>
                          <td>
                            <div className="score-cell">
                              <div className="score-track">
                                <div
                                  className="score-fill"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, c.score ?? 0))}%`,
                                  }}
                                />
                              </div>
                              <span className="score-value">
                                {c.score ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td>{c.estimatedPatients.toLocaleString()}</td>
                          <td>{c.siteCount}</td>
                          <td>{c.regulatoryWeeks}w</td>
                          <td>
                            {c.competingTrials}
                            {c.competingTrialsSource === "live" && (
                              <span
                                className="chip live-chip"
                                title="Live count from ClinicalTrials.gov"
                              >
                                live
                              </span>
                            )}
                          </td>
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
    </div>
  );
}
