import { useState } from "react";
import { usePipeline } from "../context/PipelineContext";
import WhyThisRating from "./WhyThisRating";
import WizardNextLink from "./WizardNextLink";
import SaveRunDialog from "./SaveRunDialog";
import { SaveIcon } from "./Icons";

// Same header/scroll skeleton as Stage 6/7 (fixed tag + Save action up
// top, content scrolling inside .card-scroll-body below) but keeps the
// gradient "hero" treatment that marks this as the final result.
export default function RecommendationPanel() {
  const {
    finalResult,
    llmInfo,
    canSave,
    saveLabel,
    setSaveLabel,
    saving,
    saveMessage,
    handleSave,
  } = usePipeline();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  if (!finalResult) return null;

  return (
    <div className="card recommendation-card">
      <div className="pipeline-card-head">
        <span className="tag tag-on-dark">Stage 8 Output</span>
        {canSave && (
          <button
            type="button"
            className="save-run-btn"
            onClick={() => setSaveDialogOpen(true)}
          >
            <SaveIcon className="btn-icon" />
            Save
          </button>
        )}
      </div>
      <div style={{ height: "16px" }} />
      <div className="card-scroll-body">
        <div className="final-grid">
          <div className="item">
            <div className="k">Region</div>
            <div className="v">
              {finalResult.region}, {finalResult.country}
            </div>
          </div>
          <div className="item">
            <div className="k">Estimated Patient Population</div>
            <div className="v">
              {finalResult.estimatedPatients?.toLocaleString()}
            </div>
          </div>
          <div className="item">
            <div className="k">Recommended Site</div>
            <div className="v">{finalResult.recommendedSite}</div>
          </div>
          <div className="item">
            <div className="k">Site Score</div>
            {/* Hovering gives the full component derivation, the same way
                the risk badge explains its level rather than just
                asserting it. */}
            <div className="v" title={finalResult.scoreExplanation}>
              {finalResult.score}/100
              {finalResult.confidence !== "High" && (
                <span className="score-confidence">
                  {" "}
                  ({finalResult.confidence.toLowerCase()} confidence)
                </span>
              )}
            </div>
          </div>
          <div className="item">
            <div className="k">Risk Level</div>
            <div className="v">{finalResult.riskLevel} Risk</div>
          </div>
        </div>

        {finalResult.riskExplanation && (
          <div className="final-why">
            <div className="final-why-title">
              Why this site is rated {finalResult.riskLevel}
            </div>
            <WhyThisRating explanation={finalResult.riskExplanation} onDark />
          </div>
        )}

        <p className="final-text">
          <strong>AI Recommendation ({llmInfo}):</strong> {finalResult.text}
        </p>
      </div>

      <WizardNextLink />

      {saveDialogOpen && (
        <SaveRunDialog
          label={saveLabel}
          onLabelChange={setSaveLabel}
          saving={saving}
          message={saveMessage}
          onSave={handleSave}
          onClose={() => setSaveDialogOpen(false)}
        />
      )}
    </div>
  );
}
