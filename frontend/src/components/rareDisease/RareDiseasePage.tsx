import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TopBar from "../layout/TopBar";
import StageLoader from "../ui/StageLoader";
import { usePipeline } from "../../hooks/usePipeline";
import { fetchRareDiseaseDetail } from "../../services/rareDisease.service";
import { fetchNctLookup } from "../../services/nctLookup.service";
import type { RareDiseaseDetail, TrialForm } from "../../types";

export default function RareDiseasePage({
  orphaCode,
  onBack,
  onRunAnalysis,
}: {
  orphaCode: string;
  onBack: () => void;
  onRunAnalysis: () => void;
}) {
  const { runAnalysisFromNct } = usePipeline();
  const [detail, setDetail] = useState<RareDiseaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningNctId, setRunningNctId] = useState<string | null>(null);
  const [runLookupError, setRunLookupError] = useState<string | null>(null);
  const [nctPopover, setNctPopover] = useState<{
    nctId: string;
    top: number;
    left: number;
  } | null>(null);
  const closePopoverTimerRef = useRef<number | null>(null);

  function openNctPopover(nctId: string, anchor: HTMLElement) {
    if (closePopoverTimerRef.current !== null) {
      window.clearTimeout(closePopoverTimerRef.current);
      closePopoverTimerRef.current = null;
    }
    const rect = anchor.getBoundingClientRect();
    setNctPopover({ nctId, top: rect.bottom + 6, left: rect.left });
  }
  function scheduleClosePopover() {
    closePopoverTimerRef.current = window.setTimeout(() => setNctPopover(null), 200);
  }
  function cancelClosePopover() {
    if (closePopoverTimerRef.current !== null) {
      window.clearTimeout(closePopoverTimerRef.current);
      closePopoverTimerRef.current = null;
    }
  }

  async function handleRunAnalysisForTrial(nctId: string) {
    setRunningNctId(nctId);
    setRunLookupError(null);
    try {
      const result = await fetchNctLookup(nctId);
      if (!result.indication) {
        setRunLookupError(
          `${nctId} doesn't disclose a condition, so an analysis can't be auto-run from it.`,
        );
        return;
      }
      const newForm: TrialForm = {
        indication: result.indication,
        phase: result.phase ?? "",
        sampleSize: result.enrollmentCount ?? "",
        durationMonths: result.durationMonths ?? "",
        budgetTier: "All",
        regions: [],
        ageGroups: result.ageGroups,
      };
      onRunAnalysis();
      runAnalysisFromNct(result, newForm);
    } catch (err) {
      setRunLookupError((err as Error).message);
    } finally {
      setRunningNctId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchRareDiseaseDetail(orphaCode)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orphaCode]);

  return (
    <div className="app-shell">
      <TopBar
        onGoToLanding={onBack}
        onOpenHistory={() => {}}
        onEditParameters={() => {}}
        showEditParameters={false}
      />

      <div className="rare-disease-page">
        {loading && (
          <div className="rare-disease-loading-wrap">
            <StageLoader label="Loading live Orphanet data…" />
          </div>
        )}

        {!loading && error && (
          <div className="card">
            <p className="landing-error">{error}</p>
          </div>
        )}

        {!loading && !error && detail && (
          <>
            <div className="card rare-disease-identity">
              <h1 className="rare-disease-name">{detail.name}</h1>
              <div className="rare-disease-badges">
                <span className="rare-disease-badge rare-disease-badge--accent">
                  ORPHA:{detail.orphaCode}
                </span>
                {detail.typology && (
                  <span className="rare-disease-badge">{detail.typology}</span>
                )}
                {detail.crossReferences.map((ref) => (
                  <span
                    key={`${ref.source}-${ref.reference}`}
                    className="rare-disease-badge"
                  >
                    {ref.source}: {ref.reference}
                  </span>
                ))}
              </div>
              {detail.definition && (
                <p className="rare-disease-definition">{detail.definition}</p>
              )}
              {detail.synonyms.length > 0 && (
                <p className="rare-disease-synonyms">
                  Also known as: {detail.synonyms.join(", ")}
                </p>
              )}
              <p className="rare-disease-source">
                Source: {detail.sources.nomenclature}
              </p>
            </div>

            {detail.warnings.length > 0 && (
              <div className="shell-notice rare-disease-warnings">
                {detail.warnings.map((w) => (
                  <p key={w} className="notice-text">
                    {w}
                  </p>
                ))}
              </div>
            )}

            <div className="rare-disease-grid">
              <div className="card">
                <h2>Inheritance &amp; Age of Onset</h2>
                {detail.inheritance.length === 0 &&
                detail.averageAgeOfOnset.length === 0 &&
                detail.averageAgeOfDeath.length === 0 ? (
                  <p className="predict-placeholder">
                    Not published by Orphanet for this disease.
                  </p>
                ) : (
                  <dl className="landing-confirm-grid">
                    <dt>Type of Inheritance</dt>
                    <dd>
                      {detail.inheritance.length > 0
                        ? detail.inheritance.join(", ")
                        : "Not disclosed"}
                    </dd>
                    <dt>Average Age of Onset</dt>
                    <dd>
                      {detail.averageAgeOfOnset.length > 0
                        ? detail.averageAgeOfOnset.join(", ")
                        : "Not disclosed"}
                    </dd>
                    <dt>Average Age of Death</dt>
                    <dd>
                      {detail.averageAgeOfDeath.length > 0
                        ? detail.averageAgeOfDeath.join(", ")
                        : "Not disclosed"}
                    </dd>
                  </dl>
                )}
                <p className="rare-disease-source">
                  Source: {detail.sources.naturalHistory}
                </p>
              </div>

              <div className="card">
                <h2>At a Glance</h2>
                <dl className="landing-confirm-grid">
                  <dt>ORPHAcode</dt>
                  <dd>{detail.orphaCode}</dd>
                  <dt>Typology</dt>
                  <dd>{detail.typology ?? "Not disclosed"}</dd>
                  <dt>Prevalence Records</dt>
                  <dd>{detail.prevalence.length}</dd>
                  <dt>Trials Found</dt>
                  <dd>{detail.trialSites.length}</dd>
                </dl>
              </div>
            </div>

            <div className="card">
              <h2>Prevalence &amp; Incidence</h2>
              {detail.prevalence.length === 0 ? (
                <p className="predict-placeholder">
                  Not published by Orphanet for this disease.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="requirement-checklist rare-disease-table rare-disease-prevalence-table">
                    <colgroup>
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "38%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Class</th>
                        <th>Value</th>
                        <th>Geographic Area</th>
                        <th>Validation</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.prevalence.map((p, i) => (
                        <tr key={i}>
                          <td>{p.type ?? "—"}</td>
                          <td>{p.prevalenceClass ?? p.qualification ?? "—"}</td>
                          <td>{p.value ?? "—"}</td>
                          <td>{p.geographicArea ?? "—"}</td>
                          <td>{p.validationStatus ?? "—"}</td>
                          <td className="rare-disease-cite">{p.source ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="rare-disease-source">
                Source: {detail.sources.epidemiology}
              </p>
            </div>

            <div className="card">
              <h2>Trials &amp; Sites (ClinicalTrials.gov)</h2>
              {runLookupError && <p className="landing-error">{runLookupError}</p>}
              {detail.trialSites.length === 0 ? (
                <p className="predict-placeholder">
                  No ClinicalTrials.gov trials found for this disease's Orphanet
                  name or synonyms.
                </p>
              ) : (
                <div className="table-scroll">
                  <table className="requirement-checklist rare-disease-table rare-disease-trials-table">
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "34%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>NCT ID</th>
                        <th>Title</th>
                        <th>Facility</th>
                        <th>Location</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.trialSites.map((s, i) => (
                        <tr key={`${s.nctId}-${i}`}>
                          <td>
                            <a
                              href={`https://clinicaltrials.gov/study/${s.nctId}`}
                              target="_blank"
                              rel="noreferrer"
                              onMouseEnter={(e) => openNctPopover(s.nctId, e.currentTarget)}
                              onMouseLeave={scheduleClosePopover}
                              onFocus={(e) => openNctPopover(s.nctId, e.currentTarget)}
                              onBlur={scheduleClosePopover}
                            >
                              {s.nctId}
                            </a>
                          </td>
                          <td>{s.briefTitle ?? "—"}</td>
                          <td>{s.facility ?? "—"}</td>
                          <td>
                            {[s.city, s.state, s.country]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                          <td>{s.status ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="rare-disease-source">
                Source: {detail.sources.trials}
              </p>
            </div>
          </>
        )}
      </div>

      {nctPopover &&
        createPortal(
          <div
            className="rare-disease-nct-popover"
            style={{ position: "fixed", top: nctPopover.top, left: nctPopover.left }}
            onMouseEnter={cancelClosePopover}
            onMouseLeave={scheduleClosePopover}
          >
            <button
              type="button"
              className="rare-disease-run-btn"
              disabled={runningNctId === nctPopover.nctId}
              onClick={() => handleRunAnalysisForTrial(nctPopover.nctId)}
            >
              {runningNctId === nctPopover.nctId ? (
                <span className="spinner" />
              ) : (
                "Run Analysis"
              )}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
