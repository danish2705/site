import { usePipeline } from "../../hooks/usePipeline";
import Select from "../ui/Select";
import RegionMultiSelect from "../prediction/RegionMultiSelect";

const PHASES = ["Phase I", "Phase II", "Phase III", "Phase IV"];
const BUDGETS = ["Low", "Mid", "High"];
const AGE_GROUPS = ["Child (0–17)", "Adult (18–64)", "Older Adult (65+)"];

// Illustrative typical-duration ranges shown as a live hint once a phase is
// picked — not derived from any live/LLM source, just a rough rule of thumb
// to help the user judge whether their entered duration is in a sane range.
const PHASE_DURATION_HINT: Record<string, string> = {
  "Phase I": "12–24",
  "Phase II": "18–30",
  "Phase III": "24–48",
  "Phase IV": "12–36",
};

export default function Sidebar() {
  const { meta, form, setForm, regionOptions, running, handleSubmit } =
    usePipeline();

  const sampleSizeValid =
    form.sampleSize !== "" && Number(form.sampleSize) > 0;
  const durationValid =
    form.durationMonths !== "" && Number(form.durationMonths) > 0;

  const fieldStatus = [
    { key: "indication", label: "Indication", done: !!form.indication },
    { key: "phase", label: "Phase", done: !!form.phase },
    { key: "ageGroups", label: "Age Group", done: form.ageGroups.length > 0 },
    { key: "sampleSize", label: "Target Enrollment", done: sampleSizeValid },
    { key: "regions", label: "Region / Country", done: form.regions.length > 0 },
    { key: "durationMonths", label: "Duration", done: durationValid },
    { key: "budgetTier", label: "Budget Tier", done: !!form.budgetTier },
  ];
  const doneCount = fieldStatus.filter((f) => f.done).length;
  const totalCount = fieldStatus.length;
  const allSet = doneCount === totalCount;
  const missingLabels = fieldStatus.filter((f) => !f.done).map((f) => f.label);

  const durationHint = form.phase ? PHASE_DURATION_HINT[form.phase] : null;

  return (
    <aside className="sidebar-panel">
      <form className="card sidebar-form" onSubmit={handleSubmit}>
        <div className="sidebar-form-title">
          <span className="sidebar-form-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 3v2h6V3" />
              <path d="M8 10h8M8 14h8M8 18h5" />
            </svg>
          </span>
          Analysis Parameters
        </div>

        <div className="sidebar-progress" data-tooltip={`${doneCount} of ${totalCount} fields set`}>
          <div className="sidebar-progress-track">
            <div
              className="sidebar-progress-fill"
              style={{ width: `${(doneCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="sidebar-progress-count">
            {doneCount} of {totalCount} set
          </span>
        </div>

        <div className="sidebar-form-scroll">
          <label className={`field-block${fieldStatus[0].done ? " field-block--done" : ""}`}>
            <span className="field-label">
              Indication <span className="field-required">*</span>
              {fieldStatus[0].done && <span className="field-check-badge">✓</span>}
            </span>
            <Select
              fullWidth
              value={form.indication}
              onChange={(v) => setForm({ ...form, indication: v, regions: [] })}
              disabled={!meta}
              placeholder="Select indication…"
              options={(meta?.indications ?? []).map((ind) => ({
                value: ind,
                label: ind,
              }))}
            />
          </label>

          <label className={`field-block${fieldStatus[1].done ? " field-block--done" : ""}`}>
            <span className="field-label">
              Phase
              {fieldStatus[1].done && <span className="field-check-badge">✓</span>}
            </span>
            <div className="phase-pills">
              {PHASES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`phase-pill ${form.phase === p ? "active" : ""}`}
                  onClick={() => setForm({ ...form, phase: p })}
                >
                  {form.phase === p && (
                    <span className="phase-pill-check">✓</span>
                  )}
                  {p}
                </button>
              ))}
            </div>
          </label>

          <label className={`field-block${fieldStatus[2].done ? " field-block--done" : ""}`}>
            <span className="field-label">
              Age Group
              {fieldStatus[2].done && <span className="field-check-badge">✓</span>}
            </span>
            <div className="phase-pills">
              {AGE_GROUPS.map((a) => {
                const active = form.ageGroups.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    className={`phase-pill ${active ? "active" : ""}`}
                    onClick={() =>
                      setForm({
                        ...form,
                        ageGroups: active
                          ? form.ageGroups.filter((g) => g !== a)
                          : [...form.ageGroups, a],
                      })
                    }
                  >
                    {active && <span className="phase-pill-check">✓</span>}
                    {a}
                  </button>
                );
              })}
            </div>
          </label>

          <label className={`field-block${fieldStatus[3].done ? " field-block--done" : ""}`}>
            <span className="field-label">
              Target Enrollment
              {fieldStatus[3].done && <span className="field-check-badge">✓</span>}
            </span>
            <input
              type="number"
              min={10}
              placeholder="e.g. 300"
              value={form.sampleSize}
              onChange={(e) =>
                setForm({
                  ...form,
                  sampleSize:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </label>

          <label className={`field-block${fieldStatus[4].done ? " field-block--done" : ""}`}>
            <span className="field-label-row">
              <span className="field-label">
                Region / Country
                {fieldStatus[4].done && <span className="field-check-badge">✓</span>}
              </span>
              {form.regions.length > 0 && (
                <span className="field-selected-chip">
                  {form.regions.length} selected
                </span>
              )}
            </span>
            <RegionMultiSelect
              options={regionOptions}
              selected={form.regions}
              onChange={(regions) => setForm({ ...form, regions })}
              disabled={!meta}
            />
          </label>

          <label className={`field-block${fieldStatus[5].done ? " field-block--done" : ""}`}>
            <span className="field-label">
              Duration (months)
              {fieldStatus[5].done && <span className="field-check-badge">✓</span>}
            </span>
            <input
              type="number"
              min={1}
              placeholder="e.g. 18"
              value={form.durationMonths}
              onChange={(e) =>
                setForm({
                  ...form,
                  durationMonths:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
            {durationHint && (
              <span className="field-hint">
                Typical {form.phase} trials run {durationHint} months
              </span>
            )}
          </label>

          <label className={`field-block${fieldStatus[6].done ? " field-block--done" : ""}`}>
            <span className="field-label">
              Budget Tier
              {fieldStatus[6].done && <span className="field-check-badge">✓</span>}
            </span>
            <Select
              fullWidth
              value={form.budgetTier}
              onChange={(v) => setForm({ ...form, budgetTier: v })}
              placeholder="Select budget tier…"
              options={BUDGETS.map((b) => ({ value: b, label: b }))}
            />
          </label>
        </div>

        <button
          type="submit"
          className={`btn-primary sidebar-run-btn${allSet ? " sidebar-run-btn--ready" : ""}`}
          disabled={running || !meta || !form.indication}
        >
          <span className="sidebar-run-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2 3 14h8l-1 8 10-12h-8z" />
            </svg>
          </span>
          {running ? "Running…" : "Run Analysis"}
        </button>
        {!allSet && !running && (
          <div className="sidebar-run-hint">
            {missingLabels.length} field{missingLabels.length === 1 ? "" : "s"} left — {missingLabels.join(", ")}
          </div>
        )}
      </form>
    </aside>
  );
}
