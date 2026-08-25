import { useEffect, useRef, useState } from "react";
import type { TrialForm, RegionPredictionResponse } from "../../types";
import { predictRegion } from "../../services/region.service";
import EmptyState from "../ui/EmptyState";

export default function AIRegionPrediction({
  form,
  disabled,
  onApply,
  autoPredict = false,
  onResultChange,
  onCancelClose,
}: {
  form: TrialForm;
  disabled: boolean;
  onApply: (region: string, country: string) => void;
  /** Kick off a prediction as soon as this mounts (once), instead of
   * waiting for the user to click "Predict Region with AI" a second time
   * inside the modal — used by PredictRegionModal, since opening the modal
   * already IS the "predict" action from the user's point of view. */
  autoPredict?: boolean;
  /** Fires whenever a result becomes available/unavailable — lets
   * PredictRegionModal widen itself once there's an actual recommendation
   * to show, instead of sitting at a wide fixed width during the initial
   * "Predicting…" state when there's nothing but a title and a button. */
  onResultChange?: (hasResult: boolean) => void;
  /** Called when the user cancels the very first (autoPredict) prediction
   * — closes the modal entirely instead of leaving it open on an empty
   * "No prediction yet" placeholder with just a button, which read like a
   * broken/stuck state rather than a completed cancel. */
  onCancelClose?: () => void;
}) {
  const [result, setResult] = useState<RegionPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  useEffect(() => {
    onResultChange?.(!!result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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

  const predictAbortRef = useRef<AbortController | null>(null);

  async function predict() {
    setLoading(true);
    setError(null);
    setApplied(null);
    const controller = new AbortController();
    predictAbortRef.current = controller;
    try {
      const data = await predictRegion(
        {
          indication: form.indication,
          phase: form.phase,
          sampleSize: form.sampleSize,
          durationMonths: form.durationMonths,
          budgetTier: form.budgetTier,
        },
        controller.signal,
      );
      setResult(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // Cancelled by the user — not a real failure, stay silent.
        return;
      }
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function cancelPredict() {
    predictAbortRef.current?.abort();
    // Only closing on the initial (autoPredict) prediction — cancelling a
    // later "Re-predict" should just fall back to the existing result
    // rather than closing a modal the user is actively looking at.
    if (!result) onCancelClose?.();
  }

  const p = result?.prediction;
  const visibleCandidates = showAll
    ? (result?.candidates ?? [])
    : (result?.candidates ?? []).slice(0, 5);

  // Before a result exists, "loading" IS the whole modal (title + a
  // "Predicting…" button and nothing else beneath it) — replacing that
  // with a plain centered loader + Cancel matches every other
  // long-running step in this app (Run Analysis, Risk Register, Ranking)
  // instead of a one-off button-spinner look. Once a result exists, a
  // later "Re-predict" keeps the small inline spinner instead, so the
  // existing recommendation stays visible while the new one loads.
  if (loading && !result) {
    return (
      <div className="predict-card-content predict-card-content--loading">
        <span className="run-loading-spinner" aria-hidden="true" />
        <div className="run-loading-title">Predicting region…</div>
        <button
          type="button"
          className="btn-secondary run-loading-cancel"
          onClick={cancelPredict}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="predict-card-content">
      <div className="predict-head">
        <div className="predict-head-top predict-head-top--stacked">
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
              className="predict-btn predict-btn--square"
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
      </div>

      <div className="card-scroll-body">
        {error && <p className="error-text">{error}</p>}

        {!result && !loading && !error && (
          <EmptyState
            icon="✦"
            title="No prediction yet"
            detail="Run it to see a recommended region, why it was chosen, and how every viable region scored."
          />
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
                                data-tooltip="Live count from ClinicalTrials.gov"
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
