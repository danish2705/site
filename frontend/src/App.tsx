import { useState } from "react";
import "./styles/App.css";
import { PipelineProvider } from "./context/PipelineContext";
import { RouteProvider, useRoute } from "./context/RouteContext";
import { SiteMapProvider } from "./context/SiteMapContext";
import { ThemeProvider } from "./context/ThemeContext";
import { usePipeline } from "./hooks/usePipeline";
import TopBar from "./components/layout/TopBar";
import Sidebar from "./components/layout/Sidebar";
import WorkflowNav from "./components/layout/WorkflowNav";
import PredictRegionModal from "./components/ui/PredictRegionModal";
import CompetingTrialsPanel from "./components/prediction/CompetingTrialsPanel";
import RiskAssessmentPanel from "./components/risk/RiskAssessmentPanel";
import SiteRankingPanel from "./components/ranking/SiteRankingPanel";
import RecommendationPanel from "./components/recommendation/RecommendationPanel";
import SiteMapGlobalPage from "./components/sitemap/SiteMapGlobalPage";
import SiteMapDetailsPage from "./components/sitemap/SiteMapDetailsPage";
import SiteCombinationPlannerPage from "./components/sitemap/SiteCombinationPlannerPage";
import HistoryModal from "./components/runs/HistoryModal";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { countriesFromRegionKeys } from "./utils/region";
 
function Dashboard() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [predictModalOpen, setPredictModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { form, meta, running, error, setForm, workflowStepAvailable } =
    usePipeline();
  const { route, setRoute } = useRoute();
  const locked = !workflowStepAvailable(route);
 
  return (
    <div className="app-shell">
      <TopBar onOpenHistory={() => setHistoryOpen(true)} />
 
      <div className="dashboard-body">
        <div
          className={`sidebar-shell ${sidebarCollapsed ? "collapsed" : ""}`}
        >
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={
              sidebarCollapsed
                ? "Expand Analysis Parameters"
                : "Collapse Analysis Parameters"
            }
            aria-expanded={!sidebarCollapsed}
            aria-label={
              sidebarCollapsed
                ? "Expand Analysis Parameters"
                : "Collapse Analysis Parameters"
            }
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
          <div className="sidebar-shell-clip">
            <div className="sidebar-shell-inner">
              <Sidebar />
            </div>
          </div>
        </div>
 
        <main className="main-panel">
          {}
          <WorkflowNav
            onOpenPredictModal={() => setPredictModalOpen(true)}
          />
 
          {error && (
            <div className="shell-error">
              <p className="error-text">{error}</p>
            </div>
          )}
 
          <div className="wizard-panel">
            {locked ? (
              <div className="card">
                <p className="predict-placeholder">
                  This step isn't available yet — click "Run Analysis" in the
                  sidebar first.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRoute("site-map-global")}
                >
                  ← Back to Site Map
                </button>
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
 
      {predictModalOpen && (
        <PredictRegionModal
          form={form}
          disabled={!meta || running}
          onApply={(region, country) =>
            setForm((f) => ({
              ...f,
              regions: [`${region}||${country}`],
            }))
          }
          onClose={() => setPredictModalOpen(false)}
        />
      )}
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
      {}
      <ThemeProvider>
        <RouteProvider>
          <PipelineProvider>
            <SiteMapProvider>
              <Dashboard />
            </SiteMapProvider>
          </PipelineProvider>
        </RouteProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}