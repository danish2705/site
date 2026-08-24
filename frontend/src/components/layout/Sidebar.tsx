import { usePipeline } from "../../hooks/usePipeline";
import RegionMultiSelect from "../prediction/RegionMultiSelect";

const PHASES = ["Phase I", "Phase II", "Phase III", "Phase IV"];
const BUDGETS = ["Low", "Mid", "High"];
const AGE_GROUPS = ["Child (0–17)", "Adult (18–64)", "Older Adult (65+)"];

export default function Sidebar() {
  const { meta, form, setForm, regionOptions, running, handleSubmit } =
    usePipeline();

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

        <div className="sidebar-form-scroll">
          <label className="field-block">
            <span className="field-label">
              Indication <span className="field-required">*</span>
            </span>
            <select
              value={form.indication}
              onChange={(e) =>
                setForm({ ...form, indication: e.target.value, regions: [] })
              }
              disabled={!meta}
            >
              <option value="" disabled>
                Select indication…
              </option>
              {(meta?.indications ?? []).map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span className="field-label">Phase</span>
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

          <label className="field-block">
            <span className="field-label">Age Group</span>
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

          <label className="field-block">
            <span className="field-label">Target Enrollment</span>
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

          <label className="field-block">
            <span className="field-label">Region / Country</span>
            <RegionMultiSelect
              options={regionOptions}
              selected={form.regions}
              onChange={(regions) => setForm({ ...form, regions })}
              disabled={!meta}
            />
          </label>

          <label className="field-block">
            <span className="field-label">Duration (months)</span>
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
          </label>

          <label className="field-block">
            <span className="field-label">Budget Tier</span>
            <select
              value={form.budgetTier}
              onChange={(e) => setForm({ ...form, budgetTier: e.target.value })}
            >
              <option value="" disabled>
                Select budget tier…
              </option>
              {BUDGETS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary sidebar-run-btn"
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
      </form>
    </aside>
  );
}
