import { useEffect, useRef, useState } from "react";
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

const STRATEGY_CARD_TINT: Record<
  SiteCombinationStrategyResult["strategy"],
  string
> = {
  "lowest-risk-first": "var(--low-bg)",
  "lowest-cost-first": "var(--info-bg)",
  "highest-capacity-first": "var(--med-bg)",
  balanced: "var(--accent-soft)",
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
        <button
          type="button"
          className="predict-btn map-search-btn"
          onClick={() => run()}
          disabled={loading || !target || !country}
          data-tooltip={!country ? "Select a country above first" : undefined}
        >
          Find combination
        </button>
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
                style={{
                  padding: 12,
                  minHeight: 220,
                  border: "1px solid #d7dbe6",
                  background: STRATEGY_CARD_TINT[s.strategy] ?? "#fff",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {STRATEGY_SHORT_LABEL[s.strategy] ?? s.label}
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
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--sub)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    fontWeight: 700,
                    marginTop: 10,
                    marginBottom: 5,
                  }}
                >
                  Site
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    height: 220,
                    overflowY: "auto",
                  }}
                >
                  {s.sites.map((site) => (
                    <div
                      key={site.siteId}
                      style={{
                        padding: "6px 8px",
                        background: "#f7f8fb",
                        borderRadius: 6,
                      }}
                    >
                      <Tooltip
                        as="div"
                        text={site.siteName}
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {site.siteName}
                      </Tooltip>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginTop: 3,
                          fontSize: 11.5,
                          color: "#666",
                        }}
                      >
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
