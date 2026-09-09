import { useState, type FormEvent } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import ParametersFormFields from "./ParametersFormFields";
import AIRegionPrediction from "../prediction/AIRegionPrediction";
import TopBar from "./TopBar";
import HistoryModal from "../runs/HistoryModal";

export default function ParametersFormPage({
  onEnterDashboard,
  onGoToLanding,
}: {
  onEnterDashboard: () => void;
  onGoToLanding?: () => void;
}) {
  const { form, meta, setForm, runAnalysis } = usePipeline();
  const [historyOpen, setHistoryOpen] = useState(false);

  function handleStart(e: FormEvent) {
    e.preventDefault();
    onEnterDashboard();
    runAnalysis(form);
  }

  return (
    <div className="params-page">
      <TopBar
        onOpenHistory={() => setHistoryOpen(true)}
        onEditParameters={() => {}}
        showEditParameters={false}
        onGoToLanding={onGoToLanding}
      />
      <div className="params-page-inner">
        <div className="card params-page-card">
          <div className="params-page-columns">
            <div className="params-form-col">
              <ParametersFormFields onSubmit={handleStart} />
            </div>
            <div className="params-predict-col">
              <div className="params-predict-card">
                <AIRegionPrediction
                  form={form}
                  disabled={!meta}
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

      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
