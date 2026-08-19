import { useState } from "react";
import type { MapSiteRow, SiteCombinationResponse } from "../../types";
import { fetchSiteCombination } from "../../services/siteCombination.service";

/**
 * "Which sites, together, get me to my enrollment target" planner — the
 * combination-optimizer mechanic from Srikanth's 2024 intern demo (his
 * NCT-002+005 vs. NCT-008+108 total-cost/risk comparison). Sits below the
 * Site Map table as an additive panel: it reads the same site list already
 * fetched for the map/table above and never changes any of those numbers.
 */
export default function SiteCombinationPlanner({
  indication,
  country,
  sites,
  defaultTargetEnrollment,
}: {
  indication: string;
  /** Required — the combination optimizer calls the same country-scoped cost estimate the rest of the app uses, so a specific country (not a global/all-countries search) is needed. */
  country: string;
  sites: MapSiteRow[];
  defaultTargetEnrollment?: number;
}) {
  const [target, setTarget] = useState<number | "">(
    defaultTargetEnrollment ?? "",
  );
  const [result, setResult] = useState<SiteCombinationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!target || target <= 0) {
      setError("Enter a target enrollment greater than 0.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSiteCombination({
        indication,
        country,
        targetEnrollment: Number(target),
        sites: sites.map((s) => ({
          siteId: s.siteId,
          siteName: s.siteName,
          netAvailablePatients: s.netAvailablePatients,
          riskScore: s.riskScore,
        })),
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="predict-head-top">
        <div className="predict-head-text">
          <span className="predict-title">Site Combination Planner</span>
        </div>
      </div>
      <p className="section-hint">
        Which of the {sites.length} site(s) above, taken together, reach a
        target enrollment for the least cost/risk — compares a lowest-risk-first
        pick against a fewest-sites-first pick, the way
      </p>

      <div className="map-controls">
        <label className="map-field">
          <span>Target enrollment</span>
          <input
            type="number"
            min={1}
            placeholder="e.g. 300"
            value={target}
            onChange={(e) =>
              setTarget(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>
        <button
          type="button"
          className="predict-btn"
          onClick={run}
          disabled={loading || !target}
        >
          {loading ? (
            <>
              <span className="spinner" /> Computing…
            </>
          ) : (
            "Find combination"
          )}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <>
          <p
            className="section-hint"
            style={{ fontStyle: "italic", marginTop: 10 }}
          >
            {result.method}
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="warning-text">
              {w}
            </p>
          ))}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 10,
            }}
          >
            {result.strategies.map((s) => (
              <div
                key={s.strategy}
                className="card"
                style={{
                  padding: 12,
                  border:
                    result.recommendedStrategy === s.strategy
                      ? "2px solid #2f7d4f"
                      : "1px solid #d7dbe6",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {s.label}
                  {result.recommendedStrategy === s.strategy && (
                    <span className="chip live-chip" style={{ marginLeft: 8 }}>
                      recommended
                    </span>
                  )}
                </div>
                <div className="final-grid" style={{ marginTop: 8 }}>
                  <div className="item">
                    <div className="k">Sites needed</div>
                    <div className="v">{s.sites.length}</div>
                  </div>
                  <div className="item">
                    <div className="k">Total patients</div>
                    <div className="v">
                      {s.totalPatients.toLocaleString()}
                      {!s.meetsTarget && (
                        <span
                          className="badge medium"
                          style={{ marginLeft: 6 }}
                        >
                          short of target
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="item">
                    <div className="k">Est. total cost</div>
                    <div className="v">
                      {s.totalEstimatedCostUsd !== null
                        ? `$${s.totalEstimatedCostUsd.toLocaleString()}`
                        : "N/A (cost data unavailable)"}
                    </div>
                  </div>
                  <div className="item">
                    <div className="k">Avg. risk score</div>
                    <div className="v">
                      {s.averageRiskScore !== null
                        ? `${s.averageRiskScore}/100`
                        : "N/A"}
                    </div>
                  </div>
                </div>
                <div className="table-scroll" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th>Net available</th>
                        <th>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.sites.map((site) => (
                        <tr key={site.siteId}>
                          <td>{site.siteName}</td>
                          <td>{site.netAvailablePatients.toLocaleString()}</td>
                          <td>
                            {site.riskScore !== null
                              ? `${site.riskScore}/100`
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
