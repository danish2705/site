import { useState } from "react";
import "./styles/App.css";
import { PipelineProvider } from "./context/PipelineContext";
import { RouteProvider, useRoute } from "./context/RouteContext";
import { SiteMapProvider } from "./context/SiteMapContext";
import { usePipeline } from "./hooks/usePipeline";
import TopBar from "./components/layout/TopBar";
import Sidebar from "./components/layout/Sidebar";
import WorkflowNav from "./components/layout/WorkflowNav";
import AIRegionPrediction from "./components/prediction/AIRegionPrediction";
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
  const { form, meta, running, error, setForm } = usePipeline();
  const { route } = useRoute();

  return (
    <div className="app-shell">
      <TopBar onOpenHistory={() => setHistoryOpen(true)} />

      <div className="dashboard-body">
        <Sidebar />

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
            {route === "predict" && (
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
            {route === "site-map-global" && <SiteMapGlobalPage />}
            {route === "site-map-details" && <SiteMapDetailsPage />}
            {route === "site-combination" && <SiteCombinationPlannerPage />}
            {route === "competing" && (
              <CompetingTrialsPanel
                indication={form.indication}
                selectedCountries={countriesFromRegionKeys(form.regions)}
              />
            )}
            {route === "risk" && <RiskAssessmentPanel />}
            {route === "ranking" && <SiteRankingPanel />}
            {route === "recommendation" && <RecommendationPanel />}
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
