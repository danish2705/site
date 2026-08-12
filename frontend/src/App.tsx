import { useState } from "react";
import "./styles/App.css";
import { PipelineProvider } from "./context/PipelineContext";
import { usePipeline } from "./hooks/usePipeline";
import TopBar from "./components/layout/TopBar";
import Sidebar from "./components/layout/Sidebar";
import Stepper, { StepperStatus } from "./components/layout/Stepper";
import AIRegionPrediction from "./components/prediction/AIRegionPrediction";
import RiskAssessmentPanel from "./components/risk/RiskAssessmentPanel";
import SiteRankingPanel from "./components/ranking/SiteRankingPanel";
import RecommendationPanel from "./components/recommendation/RecommendationPanel";
import HistoryModal from "./components/runs/HistoryModal";
import ErrorBoundary from "./components/ui/ErrorBoundary";

function Dashboard() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const {
    form,
    meta,
    running,
    error,
    stages,
    progressPct,
    setForm,
    wizardStep,
    setWizardStep,
  } = usePipeline();

  return (
    <div className="app-shell">
      <TopBar onOpenHistory={() => setHistoryOpen(true)} />

      <div className="dashboard-body">
        <Sidebar />

        <main className="main-panel">
          {error && (
            <div className="shell-error">
              <p className="error-text">{error}</p>
            </div>
          )}

          <div className="card">
            <div className="pipeline-card-head">
              <span className="tag">Pipeline Progress</span>
              <StepperStatus stages={stages} progressPct={progressPct} />
            </div>
            <Stepper
              stages={stages}
              activeWizardStep={wizardStep}
              onSelectWizardStep={setWizardStep}
            />
          </div>

          <div className="wizard-panel">
            {wizardStep === "predict" && (
              <AIRegionPrediction
                form={form}
                disabled={!meta || running}
                onApply={(region, country) =>
                  setForm((f) => ({
                    ...f,
                    regions: [`${region}||${country}`],
                  }))
                }
              />
            )}
            {wizardStep === "risk" && <RiskAssessmentPanel />}
            {wizardStep === "ranking" && <SiteRankingPanel />}
            {wizardStep === "recommendation" && <RecommendationPanel />}
          </div>
        </main>
      </div>

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="app-crash-screen">
          <h2>Something went wrong</h2>
          <p>{error.message}</p>
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    >
      <PipelineProvider>
        <Dashboard />
      </PipelineProvider>
    </ErrorBoundary>
  );
}
