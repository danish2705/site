import { STAGE_LIST } from "../../constants/pipeline";
import { usePipeline } from "../../hooks/usePipeline";

/**
 * Card-based analysis progress experience — replaces the old horizontal
 * Pipeline Progress stepper. Same 8 existing backend stages
 * (constants/pipeline.ts#STAGE_LIST), same StagesMap data from
 * PipelineContext, no new stages: one card per stage, showing its name,
 * current status, a loader animation while running, and a success state
 * once complete.
 */
export default function AnalysisProgressCards() {
  const { stages, progressPct, running } = usePipeline();

  function statusLabel(status: "pending" | "in-progress" | "complete"): string {
    if (status === "complete") return "Complete";
    if (status === "in-progress") return "Running…";
    return "Pending";
  }

  return (
    <div className="card analysis-progress-panel">
      <div className="pipeline-card-head">
        <span className="tag">Analysis Progress</span>
        <span className="analysis-progress-pct">
          {running ? "Running…" : progressPct === 100 ? "Complete" : `${progressPct}%`}
        </span>
      </div>

      <div className="analysis-progress-cards">
        {STAGE_LIST.map((s) => {
          const st = stages[s.n];
          return (
            <div
              key={s.n}
              className={`analysis-progress-card status-${st.status}`}
              title={st.detail ?? statusLabel(st.status)}
            >
              <span className="analysis-progress-card-icon">
                {st.status === "complete" ? (
                  <span className="analysis-progress-check" aria-hidden="true">
                    ✓
                  </span>
                ) : st.status === "in-progress" ? (
                  <span className="spinner" aria-hidden="true" />
                ) : (
                  <span className="analysis-progress-index">{s.n}</span>
                )}
              </span>
              <span className="analysis-progress-card-body">
                <span className="analysis-progress-card-label">{s.label}</span>
                <span className="analysis-progress-card-status">
                  {statusLabel(st.status)}
                </span>
                {st.detail && (
                  <span className="analysis-progress-card-detail">
                    {st.detail}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
