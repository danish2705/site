import { useEffect, useRef, useState } from "react";
import type {
  MapSiteRow,
  OutreachDraftResponse,
  SiteCombinationResponse,
} from "../../types";
import {
  fetchOutreachDraft,
  fetchSiteCombination,
} from "../../services/siteCombination.service";
import WizardNextLink from "../ui/WizardNextLink";
import StageLoader from "../ui/StageLoader";

/**
 * "Which sites, together, get me to my enrollment target" planner — the
 * combination-optimizer mechanic from Srikanth's 2024 intern demo (his
 * NCT-002+005 vs. NCT-008+108 total-cost/risk comparison). Sits below the
 * Site Map table as an additive panel: it reads the same site list already
 * fetched for the map/table above and never changes any of those numbers.
 *
 * Site-level cost figures used here (site.siteCost) are SYNTHETIC — see
 * backend data/syntheticSiteCost.ts — since no live or LLM-groundable source
 * exists for per-facility trial costs. recruitablePatients/assumedConsentRate
 * are ALSO synthetic now (same file's syntheticConsentRateFor): a per-site
 * variation around the app's configured consent-rate assumption, not one
 * flat percentage applied identically to every site — no live or LLM
 * source discloses a real per-site screening-to-enrollment conversion rate
 * either, so this is fabricated, deterministic, and clearly labeled as
 * such, same as the cost figures.
 */
export default function SiteCombinationPlanner({
  indication,
  country,
  phase,
  sites,
  defaultTargetEnrollment,
}: {
  indication: string;
  /** Required — the combination optimizer calls the same country-scoped cost estimate the rest of the app uses, so a specific country (not a global/all-countries search) is needed. */
  country: string;
  /** Optional — passed through to outreach draft generation only. */
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

  const [drafts, setDrafts] = useState<OutreachDraftResponse | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftStrategyKey, setDraftStrategyKey] = useState<string | null>(
    null,
  );
  // Once the user types into the Target Enrollment field themselves, stop
  // overwriting it with the sidebar's value — a deliberate what-if edit
  // here shouldn't get silently reverted if the sidebar value changes.
  const userEditedTargetRef = useRef(false);
  // The last defaultTargetEnrollment value this component has already
  // auto-filled + auto-run for, so a value that arrives or changes AFTER
  // mount (not just the one present at first mount) still gets picked up
  // exactly once each, instead of only ever checking once at mount time.
  const lastAutoRunForRef = useRef<number | null>(null);

  async function run(overrideTarget?: number) {
    const effectiveTarget = overrideTarget ?? target;
    if (!effectiveTarget || effectiveTarget <= 0) {
      setError("Enter a target enrollment greater than 0.");
      return;
    }
    setLoading(true);
    setError(null);
    setDrafts(null);
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

  async function draftOutreach(strategy: SiteCombinationResponse["strategies"][number]) {
    setDraftLoading(true);
    setDraftError(null);
    setDraftStrategyKey(strategy.strategy);
    try {
      const res = await fetchOutreachDraft({
        indication,
        phase,
        targetEnrollment: result?.targetEnrollment,
        sites: strategy.sites.map((s) => {
          const src = sites.find((m) => m.siteId === s.siteId);
          return {
            siteId: s.siteId,
            siteName: s.siteName,
            city: src?.city ?? null,
            country: src?.country ?? null,
          };
        }),
      });
      setDrafts(res);
    } catch (err) {
      setDraftError((err as Error).message);
      setDrafts(null);
    } finally {
      setDraftLoading(false);
    }
  }

  // Keep the Target Enrollment field mirroring the sidebar's value —
  // whenever one is provided there (at mount, or typed in afterward while
  // this page is already open), reflect it here too — but only for as
  // long as the user hasn't typed their own number into this field.
  useEffect(() => {
    if (userEditedTargetRef.current) return;
    if (typeof defaultTargetEnrollment === "number" && defaultTargetEnrollment > 0) {
      setTarget(defaultTargetEnrollment);
    }
  }, [defaultTargetEnrollment]);

  // Auto-find the combination whenever a positive Target Enrollment from
  // the sidebar and the site list are both available — reacts any time
  // that value appears or changes (not just once at mount), same as if
  // the user had typed it in here and clicked "Find combination"
  // themselves. Calls run() with the value directly (not the `target`
  // state) so it can't race the field-sync effect above, which only takes
  // effect on the next render. Stays quiet once the user has taken over
  // the field manually, and only re-fires for a genuinely new default
  // value (not on every unrelated re-render/site refetch).
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

  return (
    <div className="card">
      <div className="predict-head-top">
        <div className="predict-head-text">
          <span className="predict-title">Site Combination Planner</span>
        </div>
      </div>
      <div className="card-scroll-body">
      <div className="map-controls">
        <label className="map-field">
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
        <button
          type="button"
          className="predict-btn"
          onClick={() => run()}
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

      {loading && !result && (
        <StageLoader label="Finding site combinations…" />
      )}

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
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
                  <div className="item">
                    <div className="k">Portfolio risk</div>
                    <div className="v">
                      {s.portfolioRiskScore !== null
                        ? `${s.portfolioRiskScore.toLocaleString()}`
                        : "N/A"}
                    </div>
                  </div>
                </div>
                <div className="table-scroll" style={{ marginTop: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th>Patients taken</th>
                        <th>Available</th>
                        <th>Risk</th>
                        <th>Est. cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.sites.map((site) => (
                        <tr key={site.siteId}>
                          <td>{site.siteName}</td>
                          <td>{site.patientsTaken.toLocaleString()}</td>
                          <td>
                            {site.recruitablePatientsAvailable.toLocaleString()}
                          </td>
                          <td>
                            {site.riskScore !== null
                              ? `${site.riskScore}/100`
                              : "N/A"}
                          </td>
                          <td>
                            {site.estimatedCostUsd !== null
                              ? `$${site.estimatedCostUsd.toLocaleString()}`
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="predict-btn"
                  style={{ marginTop: 10 }}
                  onClick={() => draftOutreach(s)}
                  disabled={draftLoading}
                >
                  {draftLoading && draftStrategyKey === s.strategy ? (
                    <>
                      <span className="spinner" /> Drafting…
                    </>
                  ) : (
                    "Draft outreach emails"
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {draftError && <p className="error-text">{draftError}</p>}

      {drafts && (
        <div className="card" style={{ marginTop: 16, padding: 12 }}>
          <div style={{ fontWeight: 600 }}>Outreach drafts (not sent)</div>
          <p className="section-hint">
            These are draft-only text — nothing is actually emailed from this
            app, and every contact address shown is a synthetic placeholder
            (ClinicalTrials.gov does not reliably disclose a real per-facility
            contact email).
          </p>
          {drafts.warnings.map((w, i) => (
            <p key={i} className="warning-text">
              {w}
            </p>
          ))}
          {drafts.drafts.map((d) => (
            <details key={d.siteId} style={{ marginTop: 8 }}>
              <summary>
                {d.siteName}{" "}
                <span className="chip" style={{ marginLeft: 6 }}>
                  synthetic contact
                </span>
              </summary>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <div>
                  <strong>To:</strong> {d.contactEmail}
                </div>
                <div>
                  <strong>Subject:</strong> {d.subject}
                </div>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    marginTop: 6,
                    fontFamily: "inherit",
                  }}
                >
                  {d.body}
                </pre>
              </div>
            </details>
          ))}
        </div>
      )}
      </div>
      <WizardNextLink />
    </div>
  );
}
