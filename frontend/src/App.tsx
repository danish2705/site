import { useState } from "react";
import "./styles/App.css";
import { PipelineProvider } from "./context/PipelineContext";
import { RouteProvider, useRoute } from "./context/RouteContext";
import { SiteMapProvider } from "./context/SiteMapContext";
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
  // Collapsed by default = false (expanded) per spec; toggled by a button
  // on the sidebar shell. Lives here (not inside Sidebar) purely so the
  // main-panel layout can react to it — no form/filter state moves, so
  // collapsing/expanding never touches any entered values.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { form, meta, running, error, setForm, workflowStepAvailable } =
    usePipeline();
  const { route, setRoute } = useRoute();
  // Gates a step's real content behind workflowStepAvailable() — closes the
  // gap where WorkflowNav disabling the nav button only stops NEW clicks:
  // this app's router is plain location.hash (see RouteContext.tsx), so
  // typing a step's hash directly, using the browser's Back/Forward
  // buttons, or simply already being on a page before its prerequisite was
  // met, all bypassed the nav-level check entirely and rendered the real
  // panel (and let it fetch/POST) regardless. Rendering the lock state here
  // instead enforces the same rule no matter how the route got set.
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
              <Sidebar onOpenPredictModal={() => setPredictModalOpen(true)} />
            </div>
          </div>
        </div>

        <main className="main-panel">
          {/* Sits above the right-side page card only — not above the
              sidebar's input form — since the workflow steps describe the
              analysis output on this side, not the input parameters. */}
          <WorkflowNav />

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
      {/* RouteProvider wraps PipelineProvider because PipelineProvider's
          handleSubmit auto-navigates to Site Map (Global) as soon as Run
          Analysis is clicked (setRoute("site-map-global")) — the user stays
          in control of navigation from there via WorkflowNav/WizardNextLink
          as later stages complete. SiteMapProvider is innermost because it
          reads the trial form via usePipeline(). */}
      <RouteProvider>
        <PipelineProvider>
          <SiteMapProvider>
            <Dashboard />
          </SiteMapProvider>
        </PipelineProvider>
      </RouteProvider>
    </ErrorBoundary>
  );
}
