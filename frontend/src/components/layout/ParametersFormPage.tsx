import type { FormEvent } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import ParametersFormFields from "./ParametersFormFields";
import AIRegionPrediction from "../prediction/AIRegionPrediction";

/**
 * Full-page Analysis Parameters form — replaces the old always-open sidebar
 * as the very first thing shown once the user picks "Enter Study Details
 * Manually" on the landing screen (the NCT search flow still skips this
 * entirely and jumps straight to the dashboard with zero form interaction).
 * "Start Analysis" sits bottom-right of the form; clicking it hands off to
 * the dashboard immediately (same pattern LandingScreen's NCT confirm-run
 * already uses) and kicks off the pipeline run behind RunAnalysisOverlay.
 * Once a run has happened, editing parameters again goes through
 * EditParametersModal (opened from TopBar) instead of this page.
 *
 * Two columns fill the page instead of the form alone floating in a mostly
 * empty page: the form on the left (~62%), and "Predict Region with AI" —
 * previously only reachable as a modal from the workflow nav's leading
 * "progress bar" tile — inline on the right (~38%), so a user can pick an
 * AI-suggested region without leaving this page or opening anything. Same
 * AIRegionPrediction component, same onApply wiring PredictRegionModal
 * already used (writes straight into form.regions); only the surrounding
 * chrome (modal -> plain panel) is different here.
 */
export default function ParametersFormPage({
  onEnterDashboard,
}: {
  onEnterDashboard: () => void;
}) {
  const { form, meta, setForm, runAnalysis } = usePipeline();

  function handleStart(e: FormEvent) {
    e.preventDefault();
    onEnterDashboard();
    runAnalysis(form);
  }

  return (
    <div className="params-page">
      <div className="params-page-inner">
        <div className="params-page-columns">
          <div className="params-form-col">
            <ParametersFormFields onSubmit={handleStart} />
          </div>
          <div className="params-predict-col">
            <div className="card params-predict-card">
              <AIRegionPrediction
                form={form}
                disabled={!meta}
                autoPredict
                onApply={(region, country) =>
                  setForm((f) => ({
                    ...f,
                    regions: [`${region}||${country}`],
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
