import { useState } from "react";
import "./App.css";
import { PipelineProvider, usePipeline } from "./context/PipelineContext";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import Stepper, { StepperStatus } from "./components/Stepper";
import AIRegionPrediction from "./components/AIRegionPrediction";
import RiskAssessmentPanel from "./components/RiskAssessmentPanel";
import SiteRankingPanel from "./components/SiteRankingPanel";
import RecommendationPanel from "./components/RecommendationPanel";
import HistoryModal from "./components/HistoryModal";

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

      {historyOpen && (
        <HistoryModal onClose={() => setHistoryOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PipelineProvider>
      <Dashboard />
    </PipelineProvider>
  );
}
