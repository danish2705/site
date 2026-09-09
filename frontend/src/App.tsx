import { useState } from "react";
import "./styles/App.css";
import { PipelineProvider } from "./context/PipelineContext";
import { RouteProvider, useRoute } from "./context/RouteContext";
import { SiteMapProvider } from "./context/SiteMapContext";
import { usePipeline } from "./hooks/usePipeline";
import TopBar from "./components/layout/TopBar";
import ParametersFormPage from "./components/layout/ParametersFormPage";
import EditParametersModal from "./components/layout/EditParametersModal";
import WorkflowNav from "./components/layout/WorkflowNav";
import CompetingTrialsPanel from "./components/prediction/CompetingTrialsPanel";
import RiskAssessmentPanel from "./components/risk/RiskAssessmentPanel";
import SiteRankingPanel from "./components/ranking/SiteRankingPanel";
import RecommendationPanel from "./components/recommendation/RecommendationPanel";
import SiteMapGlobalPage from "./components/sitemap/SiteMapGlobalPage";
import SiteMapDetailsPage from "./components/sitemap/SiteMapDetailsPage";
import SiteCombinationPlannerPage from "./components/sitemap/SiteCombinationPlannerPage";
import HistoryModal from "./components/runs/HistoryModal";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import RunAnalysisOverlay from "./components/ui/RunAnalysisOverlay";
import LandingScreen from "./components/landing/LandingScreen";
import RareDiseasePage from "./components/rareDisease/RareDiseasePage";
import { countriesFromRegionKeys } from "./utils/region";

function Dashboard({ onGoToLanding }: { onGoToLanding: () => void }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editParametersOpen, setEditParametersOpen] = useState(false);
  const { form, error, notice, dismissNotice, workflowStepAvailable } =
    usePipeline();
  const { route } = useRoute();
  const locked = !workflowStepAvailable(route);

  return (
    <div className="app-shell">
      <RunAnalysisOverlay />
      <TopBar
        onOpenHistory={() => setHistoryOpen(true)}
        onEditParameters={() => setEditParametersOpen(true)}
        onGoToLanding={onGoToLanding}
      />

      <div className="dashboard-body">
        <main className="main-panel">
          <WorkflowNav />

          {error && (
            <div className="shell-error">
              <p className="error-text">{error}</p>
            </div>
          )}

          {notice && (
            <div className="shell-notice">
              <p className="notice-text">{notice}</p>
              <button
                type="button"
                className="notice-dismiss"
                onClick={dismissNotice}
                aria-label="Dismiss notice"
              >
                ×
              </button>
            </div>
          )}

          <div className="wizard-panel">
            {locked ? (
              <div className="card">
                <p className="predict-placeholder">
                  This step isn't available yet — it unlocks as the analysis
                  progresses.
                </p>
              </div>
            ) : (
              <>
                {route === "site-map-global" && <SiteMapGlobalPage />}
                {route === "site-map-details" && <SiteMapDetailsPage />}
                {route === "site-combination" && <SiteCombinationPlannerPage />}
                {route === "competing" && (
                  <CompetingTrialsPanel
                    indication={form.indication}
                    selectedCountries={countriesFromRegionKeys(form.regions)}
                    ageGroups={form.ageGroups}
                  />
                )}
                {route === "risk" && <RiskAssessmentPanel />}
                {route === "ranking" && <SiteRankingPanel />}
                {route === "recommendation" && <RecommendationPanel />}
              </>
            )}
          </div>
        </main>
      </div>

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}

      {editParametersOpen && (
        <EditParametersModal onClose={() => setEditParametersOpen(false)} />
      )}
    </div>
  );
}

function AppShell() {
  const [entryMode, setEntryMode] = useState<
    "landing" | "form" | "dashboard" | "rare-disease"
  >("landing");
  const [rareDiseaseOrphaCode, setRareDiseaseOrphaCode] = useState<
    string | null
  >(null);

  if (entryMode === "landing") {
    return (
      <LandingScreen
        onEnterDashboard={() => setEntryMode("dashboard")}
        onStartManual={() => setEntryMode("form")}
        onOpenRareDisease={(orphaCode) => {
          setRareDiseaseOrphaCode(orphaCode);
          setEntryMode("rare-disease");
        }}
      />
    );
  }
  if (entryMode === "rare-disease" && rareDiseaseOrphaCode) {
    return (
      <RareDiseasePage
        orphaCode={rareDiseaseOrphaCode}
        onBack={() => setEntryMode("landing")}
        onRunAnalysis={() => setEntryMode("dashboard")}
      />
    );
  }
  if (entryMode === "form") {
    return (
      <ParametersFormPage
        onEnterDashboard={() => setEntryMode("dashboard")}
        onGoToLanding={() => setEntryMode("landing")}
      />
    );
  }
  return <Dashboard onGoToLanding={() => setEntryMode("landing")} />;
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
      {}
      <RouteProvider>
        <PipelineProvider>
          <SiteMapProvider>
            <AppShell />
          </SiteMapProvider>
        </PipelineProvider>
      </RouteProvider>
    </ErrorBoundary>
  );
}
