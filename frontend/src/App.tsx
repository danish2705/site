import { useEffect, useState } from "react";
import "./styles/App.css";
import { PipelineProvider } from "./context/PipelineContext";
import { RouteProvider, useRoute } from "./context/RouteContext";
import { SiteMapProvider } from "./context/SiteMapContext";
import { usePipeline } from "./hooks/usePipeline";
import Toast from "./components/ui/Toast";
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
import RunAnalysisOverlay from "./components/ui/RunAnalysisOverlay";
import { countriesFromRegionKeys } from "./utils/region";

function Dashboard() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [predictModalOpen, setPredictModalOpen] = useState(false);
  // Collapsed by default = false (expanded) per spec; toggled by a button
  // on the sidebar shell. Lives here (not inside Sidebar) purely so the
  // main-panel layout can react to it — no form/filter state moves, so
  // collapsing/expanding never touches any entered values.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const {
    form,
    meta,
    running,
    error,
    notice,
    dismissNotice,
    setForm,
    workflowStepAvailable,
    cancelSignal,
  } = usePipeline();
  // Auto-collapse the Analysis Parameters sidebar the moment "Run Analysis"
  // starts (running flips true) — the input form isn't needed anymore once
  // the pipeline is off and running, and it just eats space next to the
  // results panels. Only the user's own click on the collapse-toggle button
  // reopens it again; finishing the run does not auto-expand it back.
  useEffect(() => {
    if (running) {
      setSidebarCollapsed(true);
    }
  }, [running]);
  // Cancelling a run is different from finishing/failing one: there's
  // nothing to look at yet (no results panel to switch to), so re-expand
  // the form immediately instead of leaving the user stuck looking at a
  // collapsed sidebar and a locked step with no way back in except the
  // manual toggle.
  useEffect(() => {
    if (cancelSignal > 0) {
      setSidebarCollapsed(false);
    }
  }, [cancelSignal]);
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
      <RunAnalysisOverlay />
      <TopBar onOpenHistory={() => setHistoryOpen(true)} />

      <div className="dashboard-body">
        <div
          className={`sidebar-shell ${sidebarCollapsed ? "collapsed" : ""}`}
        >
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            // No tooltip here — this button sits right at the top edge of
            // the sidebar, just below the top bar, so a hover bubble that
            // opens upward has nowhere to render and just showed up as a
            // box clipped above the viewport.
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
          {/* Sits above the right-side page card only — not above the
              sidebar's input form — since the workflow steps describe the
              analysis output on this side, not the input parameters. */}
          <WorkflowNav onOpenPredictModal={() => setPredictModalOpen(true)} />

          {error && (
            <div className="shell-error">
              <p className="error-text">{error}</p>
            </div>
          )}

          {notice && <Toast message={notice} onDismiss={dismissNotice} />}

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
          handleSubmit navigates to Ongoing Trials (setRoute("competing"))
          once the whole pipeline finishes — a full-screen loading overlay
          (RunAnalysisOverlay) covers the screen for the run itself, so
          there's no page to control navigation from until then.
          SiteMapProvider is innermost because it reads the trial form via
          usePipeline(). */}
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
