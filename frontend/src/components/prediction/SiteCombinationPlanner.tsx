import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  MapSiteRow,
  SiteCombinationResponse,
  SiteCombinationStrategyResult,
} from "../../types";

const STRATEGY_SHORT_LABEL: Record<
  SiteCombinationStrategyResult["strategy"],
  string
> = {
  "lowest-risk-first": "Least-risky sites",
  "lowest-cost-first": "Cheapest sites",
  "highest-capacity-first": "Highest-capacity sites",
  balanced: "Balanced",
};

// Same palette as every risk/status badge elsewhere in the app (green =
// good/low-risk, blue = informational, amber = a tradeoff/warning,
// accent purple = the AI-recommended default) — used as a thin top accent
// bar + a small badge on each strategy card.
const STRATEGY_ACCENT: Record<SiteCombinationStrategyResult["strategy"], string> = {
  "lowest-risk-first": "var(--success)",
  "lowest-cost-first": "var(--info)",
  "highest-capacity-first": "var(--warning)",
  balanced: "var(--primary)",
};

// Colored card background, matching the same green/blue/amber/purple
// "-light" tinted-box treatment Final Recommendation already uses for its
// Why-#1 boxes (.why-number-one-col--strengths/--watch/--conclusion —
// success-light/warning-light/primary-light + a color-mix border tint).
// lowest-cost-first uses --info directly since there's no --info-light
// token defined; a matching low-opacity blue wash is used instead, the
// same technique the app already uses in .final-why .why-risk.
const STRATEGY_BG: Record<SiteCombinationStrategyResult["strategy"], string> = {
  "lowest-risk-first": "var(--success-light)",
  "lowest-cost-first": "rgba(37, 99, 235, 0.08)",
  "highest-capacity-first": "var(--warning-light)",
  balanced: "var(--primary-light)",
};
const STRATEGY_BORDER: Record<SiteCombinationStrategyResult["strategy"], string> = {
  "lowest-risk-first": "color-mix(in srgb, var(--success) 25%, white)",
  "lowest-cost-first": "color-mix(in srgb, var(--info) 25%, white)",
  "highest-capacity-first": "color-mix(in srgb, var(--warning) 30%, white)",
  balanced: "color-mix(in srgb, var(--primary) 20%, white)",
};
import { fetchSiteCombination } from "../../services/siteCombination.service";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";
import Select from "../ui/Select";
import Tooltip from "../ui/Tooltip";

export default function SiteCombinationPlanner({
  indication,
  country,
  selectedCountries,
  onCountryChange,
  countrySearchLoading,
  sites,
  defaultTargetEnrollment,
}: {
  indication: string;
  country: string;
  selectedCountries?: string[];
  onCountryChange?: (country: string) => void;
  onSearchCountry?: () => void;
  countrySearchLoading?: boolean;
  phase?: string;
  sites: MapSiteRow[];
  defaultTargetEnrollment?: number;
}) {
  const [target, setTarget] = useState<number | "">(
    defaultTargetEnrollment ?? "",
  );
  const [result, setResult] = useState<SiteCombinationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userEditedTargetRef = useRef(false);
  const lastAutoRunForRef = useRef<number | null>(null);

  async function run(overrideTarget?: number) {
    const effectiveTarget = overrideTarget ?? target;
    if (!effectiveTarget || effectiveTarget <= 0) {
      setError("Enter a target enrollment greater than 0.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSiteCombination({
        indication,
        country,
        targetEnrollment: Number(effectiveTarget),
        sites: sites.map((s) => ({
          siteId: s.siteId,
          siteName: s.siteName,
          city: s.city,
          country: s.country,
          recruitablePatients: s.recruitablePatients,
          riskScore: s.riskScore,
          baseCostUsd: s.siteCost.baseCostUsd,
          perPatientCostUsd: s.siteCost.perPatientCostUsd,
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

  useEffect(() => {
    if (userEditedTargetRef.current) return;
    if (typeof defaultTargetEnrollment === "number" && defaultTargetEnrollment > 0) {
      setTarget(defaultTargetEnrollment);
    }
  }, [defaultTargetEnrollment]);

  useEffect(() => {
    if (userEditedTargetRef.current) return;
    if (typeof defaultTargetEnrollment !== "number" || defaultTargetEnrollment <= 0) {
      return;
    }
    if (sites.length === 0) return;
    if (lastAutoRunForRef.current === defaultTargetEnrollment) return;
    lastAutoRunForRef.current = defaultTargetEnrollment;
    run(defaultTargetEnrollment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTargetEnrollment, sites.length]);

  const showLoadingOverlay = loading || !!countrySearchLoading;

  return (
    <div className="card">
      <div className="card-scroll-body" style={{ position: "relative" }}>
      {}
      {showLoadingOverlay && (
        <div className="table-loading-overlay">
          <StageLoader
            label={
              countrySearchLoading
                ? "Loading sites…"
                : "Finding site combinations…"
            }
          />
        </div>
      )}
      <div className="map-controls">
        {selectedCountries && selectedCountries.length > 0 ? (
          <>
            {}
            <label className="map-field" style={{ marginTop: 20 }}>
              <Select
                value={country}
                onChange={(v) => onCountryChange?.(v)}
                disabled={!!countrySearchLoading}
                options={selectedCountries.map((c) => ({ value: c, label: c }))}
              />
            </label>
          </>
        ) : (
          <span className="map-field-note">
            No region selected yet — pick one in Step 1 (or apply an AI
            prediction) to choose a country here.
          </span>
        )}

        <label className="map-field" style={{ marginLeft: "auto" }}>
          <span>Target enrollment</span>
          <input
            type="number"
            min={1}
            placeholder="e.g. 300"
            value={target}
            onChange={(e) => {
              userEditedTargetRef.current = true;
              setTarget(e.target.value === "" ? "" : Number(e.target.value));
            }}
          />
        </label>
        {}
        <Tooltip
          as="button"
          type="button"
          className="predict-btn map-search-btn"
          onClick={() => run()}
          disabled={loading || !target || !country}
          text={!country ? "Select a country above first" : undefined}
        >
          Find combination
        </Tooltip>
      </div>

      {error && <p className="error-text">{error}</p>}

      {result && (
        <>
          {result.warnings.map((w, i) => (
            <p key={i} className="warning-text">
              {w}
            </p>
          ))}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 12,
              marginTop: 10,
              alignItems: "start",
            }}
          >
            {[...result.strategies]
              .sort((a, b) => {
                const aBalanced = a.strategy === "balanced" ? 1 : 0;
                const bBalanced = b.strategy === "balanced" ? 1 : 0;
                return aBalanced - bBalanced;
              })
              .map((s) => (
              <div
                key={s.strategy}
                className="card combo-strategy-card"
                style={
                  {
                    minHeight: 220,
                    "--strategy-accent": STRATEGY_ACCENT[s.strategy] ?? "var(--accent)",
                    "--strategy-bg": STRATEGY_BG[s.strategy] ?? "var(--card)",
                    "--strategy-border": STRATEGY_BORDER[s.strategy] ?? "var(--line)",
                  } as CSSProperties
                }
              >
                <div className="combo-strategy-card-head">
                  <span className="combo-strategy-card-title">
                    {STRATEGY_SHORT_LABEL[s.strategy] ?? s.label}
                  </span>
                  {s.strategy === "balanced" && (
                    <span className="badge accent">Recommended</span>
                  )}
                </div>
                <div className="final-grid" style={{ marginTop: 12 }}>
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
                <div className="combo-strategy-section-label">Site</div>
                <div className="combo-strategy-site-list">
                  {s.sites.map((site) => (
                    <div key={site.siteId} className="combo-strategy-site-row">
                      <Tooltip
                        as="div"
                        text={site.siteName}
                        className="combo-strategy-site-name"
                      >
                        {site.siteName}
                      </Tooltip>
                      <div className="combo-strategy-site-stats">
                        <span>
                          Available: {site.recruitablePatientsAvailable.toLocaleString()}
                        </span>
                        <span>Taken: {site.patientsTaken.toLocaleString()}</span>
                        <span>
                          Risk:{" "}
                          {site.riskScore !== null
                            ? `${site.riskScore}/100`
                            : "N/A"}
                        </span>
                        <span>
                          Cost:{" "}
                          {site.estimatedCostUsd !== null
                            ? `$${site.estimatedCostUsd.toLocaleString()}`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      </div>
      <WizardNextLink />
    </div>
  );
}
