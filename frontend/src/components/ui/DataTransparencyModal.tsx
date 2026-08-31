import { usePipeline } from "../../hooks/usePipeline";
import { useSiteMap } from "../../context/SiteMapContext";
import { CloseIcon } from "./Icons";
import EmptyState from "./EmptyState";

interface Row {
  label: string;
  detail: string;
}

function Section({
  title,
  liveRows,
  syntheticRows,
}: {
  title: string;
  liveRows: Row[];
  syntheticRows: Row[];
}) {
  if (liveRows.length === 0 && syntheticRows.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--sub)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          {liveRows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "6px 0",
                borderBottom: i < liveRows.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <span
                data-tooltip="Live / real data"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#2e9e6b",
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--sub)" }}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          {syntheticRows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "6px 0",
                borderBottom:
                  i < syntheticRows.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <span
                data-tooltip="Synthetic / LLM-estimated data"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#d99a2b",
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--sub)" }}>{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DataTransparencyModal({ onClose }: { onClose: () => void }) {
  const { meta, ranking, riskAssessment, finalResult } = usePipeline();
  const { allSites } = useSiteMap();

  const metaLive: Row[] = [];
  const metaSynthetic: Row[] = [];
  if (meta) {
    if (meta.indicationsSource !== "fallback") {
      metaLive.push({
        label: "Indication list",
        detail: "Live ClinicalTrials.gov vocabulary",
      });
    } else {
      metaSynthetic.push({
        label: "Indication list",
        detail: meta.metaWarning || "Fallback static list — live lookup failed",
      });
    }
    if (meta.liveConditions && meta.liveConditions.length > 0) {
      metaLive.push({
        label: "Condition frequency",
        detail: `Live — ${meta.liveConditions.length} conditions ranked from ClinicalTrials.gov`,
      });
    }
    if (meta.liveCountries && meta.liveCountries.length > 0) {
      metaLive.push({
        label: "Country frequency",
        detail: `Live — ${meta.liveCountries.length} countries ranked from ClinicalTrials.gov`,
      });
    }
  }

  const mapLive: Row[] = [];
  const mapSynthetic: Row[] = [];
  if (allSites.length > 0) {
    const n = allSites.length;
    const coordsLive = allSites.filter((s) => s.coordsSource !== "approximate").length;
    mapLive.push({
      label: "Facility geocoding",
      detail:
        coordsLive === n
          ? `Live for all ${n} sites (Google/OpenStreetMap)`
          : `Live for ${coordsLive} of ${n} sites — the rest fell back to an approximate location`,
    });

    const distanceLive = allSites.filter(
      (s) => s.catchmentDistanceSource === "live-google" || s.catchmentDistanceSource === "live-osrm",
    ).length;
    if (distanceLive > 0) {
      mapLive.push({
        label: "Catchment drive-distance",
        detail: `Real routed distance used for ${distanceLive} of ${n} sites`,
      });
    }

    mapLive.push({
      label: "Facility recruiting status",
      detail: `Live ClinicalTrials.gov status for all ${n} sites`,
    });

    mapSynthetic.push({
      label: "Population within catchment radius",
      detail: `Synthetic model for all ${n} sites — no live small-area population source`,
    });
    mapSynthetic.push({
      label: "Patient segment split",
      detail: "Illustrative heuristic split, not real claims data",
    });
    mapSynthetic.push({
      label: "Individual patient sample records",
      detail: "Fabricated illustrative sample — no live per-patient source",
    });
    const riskEstimated = allSites.filter((s) => s.riskSource === "llm-estimated").length;
    if (riskEstimated > 0) {
      mapSynthetic.push({
        label: "Site risk score",
        detail: `LLM-estimated for ${riskEstimated} of ${n} sites`,
      });
    }
    mapSynthetic.push({
      label: "Per-site cost & consent rate",
      detail: `Deterministic synthetic model for all ${n} sites — no live per-facility cost source`,
    });
  }

  const rankLive: Row[] = [];
  const rankSynthetic: Row[] = [];
  if (ranking && ranking.length > 0) {
    const n = ranking.length;
    const liveFieldSet = new Set<string>();
    let anyLive = 0;
    let allEstimated = 0;
    ranking.forEach((r) => {
      if (r.liveKpiFields && r.liveKpiFields.length > 0) {
        anyLive += 1;
        r.liveKpiFields.forEach((f) => liveFieldSet.add(f));
      }
      if (r.dataSource === "llm-estimated") allEstimated += 1;
    });
    if (anyLive > 0) {
      rankLive.push({
        label: "Recruitment / Retention / Diversity KPIs",
        detail: `Real data backed ${anyLive} of ${n} ranked sites (${Array.from(liveFieldSet).join(", ")})`,
      });
    }
    rankLive.push({
      label: "Site recruiting status",
      detail: `Live ClinicalTrials.gov status for all ${n} ranked sites`,
    });
    rankSynthetic.push({
      label: "Cost component",
      detail: "Synthetic cost model — factored into every site's score",
    });
    if (allEstimated > 0) {
      rankSynthetic.push({
        label: "KPI fields without a live match",
        detail: `LLM-estimated for ${allEstimated} of ${n} sites (Excel baseline unavailable)`,
      });
    }
  }

  const riskLive: Row[] = [];
  const riskSynthetic: Row[] = [];
  if (riskAssessment && riskAssessment.length > 0) {
    const records = riskAssessment.flatMap((r) => r.riskRecords);
    const liveCount = records.filter((r) => r.dataSource === "live").length;
    const excelCount = records.filter((r) => r.dataSource === "excel").length;
    const estimatedCount = records.filter((r) => r.dataSource === "llm-estimated" || !r.dataSource).length;
    if (liveCount + excelCount > 0) {
      riskLive.push({
        label: "Risk register entries",
        detail: `${liveCount} live + ${excelCount} historical (Excel) of ${records.length} total entries`,
      });
    }
    riskLive.push({
      label: "Site recruiting status",
      detail: `Live ClinicalTrials.gov status for all ${riskAssessment.length} sites`,
    });
    if (estimatedCount > 0) {
      riskSynthetic.push({
        label: "Risk register entries",
        detail: `LLM-estimated for ${estimatedCount} of ${records.length} total entries`,
      });
    }
  }

  const finalLive: Row[] = [];
  const finalSynthetic: Row[] = [];
  if (finalResult) {
    if (finalResult.liveKpiFields && finalResult.liveKpiFields.length > 0) {
      finalLive.push({
        label: `Recommended site: ${finalResult.recommendedSite}`,
        detail: `Real data backing: ${finalResult.liveKpiFields.join(", ")}`,
      });
    }
    if (finalResult.dataSource === "llm-estimated") {
      finalSynthetic.push({
        label: `Recommended site: ${finalResult.recommendedSite}`,
        detail: "Remaining KPI fields LLM-estimated — no Excel baseline for this facility",
      });
    }
  }

  const outreachSynthetic: Row[] = [
    {
      label: "Outreach contact email",
      detail: "Fabricated placeholder — ClinicalTrials.gov does not disclose real per-facility contacts",
    },
  ];

  const nothingLoaded =
    !meta && allSites.length === 0 && !ranking && !riskAssessment && !finalResult;

  return (
    <div className="run-modal-backdrop" onClick={onClose}>
      <div
        className="run-modal run-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="run-modal-head run-modal-head--sticky">
          <div>
            <h2>Data Transparency</h2>
            <p className="muted">
              What's real vs. synthetic in this run — <span style={{ color: "#2e9e6b" }}>●</span> live data from
              ClinicalTrials.gov / Google / OpenStreetMap, <span style={{ color: "#d99a2b" }}>●</span> synthetic
              or LLM-estimated data used where no live source exists.
            </p>
          </div>
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            data-tooltip="Close"
            aria-label="Close"
          >
            <CloseIcon className="btn-icon" />
          </button>
        </div>

        {nothingLoaded && (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              title="Nothing loaded yet"
              detail="Run an analysis or open Site Map to see what data it used."
            />
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Section title="Indication & Trial Vocabulary" liveRows={metaLive} syntheticRows={metaSynthetic} />
          <Section title="Site Map" liveRows={mapLive} syntheticRows={mapSynthetic} />
          <Section title="Site Ranking" liveRows={rankLive} syntheticRows={rankSynthetic} />
          <Section title="Risk Register" liveRows={riskLive} syntheticRows={riskSynthetic} />
          <Section title="Final Recommendation" liveRows={finalLive} syntheticRows={finalSynthetic} />
          <Section title="Outreach" liveRows={[]} syntheticRows={outreachSynthetic} />
        </div>
      </div>
    </div>
  );
}
