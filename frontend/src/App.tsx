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
import { countriesFromRegionKeys } from "./utils/region";
 
function Dashboard({ onGoToLanding }: { onGoToLanding: () => void }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  // Opens EditParametersModal — the Analysis Parameters form no longer lives
  // as a permanent sidebar; this is the only way back into it once a run has
  // started (see TopBar's "Edit Parameters" button).
  const [editParametersOpen, setEditParametersOpen] = useState(false);
  const {
    form,
    error,
    notice,
    dismissNotice,
    workflowStepAvailable,
  } = usePipeline();
  const { route } = useRoute();
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

/**
 * Gates the app behind the landing/start screen (NCT lookup or manual entry)
 * on every fresh load — plain component state, not persisted, so a reload
 * always lands back on the landing screen. Sits inside every provider (same
 * as Dashboard did before) since LandingScreen's NCT flow needs usePipeline()
 * (setForm/runAnalysis) to auto-fill and kick off the analysis itself.
 *
 * Three modes, not two: "landing" -> "form" -> "dashboard".
 * - NCT search still skips straight from "landing" to "dashboard" with zero
 *   form interaction (handleConfirmRun already calls onEnterDashboard()
 *   itself before kicking off runAnalysis).
 * - "Enter Study Details Manually" now goes to "form" instead — the
 *   Analysis Parameters form as its own full page, "Start Analysis" bottom
 *   right (see ParametersFormPage). Submitting there moves to "dashboard"
 *   and starts the run, same handoff pattern as the NCT flow.
 * - Once in "dashboard", editing parameters again goes through
 *   EditParametersModal (opened from TopBar) rather than back through this
 *   full page — entryMode itself never needs to leave "dashboard" again.
 */
function AppShell() {
  const [entryMode, setEntryMode] = useState<"landing" | "form" | "dashboard">(
    "landing",
  );

  if (entryMode === "landing") {
    return (
      <LandingScreen
        onEnterDashboard={() => setEntryMode("dashboard")}
        onStartManual={() => setEntryMode("form")}
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