import { usePipeline } from "../../hooks/usePipeline";
import ScoreBreakdown from "./ScoreBreakdown";
import WizardNextLink from "../ui/WizardNextLink";

export default function SiteRankingPanel() {
  const { ranking } = usePipeline();
  if (!ranking) return null;

  return (
    <div className="card">
      <span className="tag">Stage 7 Output</span>
      <div className="card-scroll-body">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Site</th>
                <th>Region</th>
                <th>Score</th>
                <th>Breakdown</th>
                <th>Protocol fit</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.siteId}>
                  <td>{r.rank}</td>
                  <td>
                    {r.siteName}
                    <div className="site-id">{r.siteId}</div>
                  </td>
                  <td>{r.region}</td>
                  <td>
                    {r.score}/100
                    {r.confidence !== "High" && (
                      <div
                        className="score-confidence"
                        title={r.caveats.join(" ")}
                      >
                        {r.confidence.toLowerCase()} confidence
                      </div>
                    )}
                  </td>
                  <td>
                    <ScoreBreakdown components={r.components} />
                  </td>
                  <td>
                    {r.meetsRequirements ? (
                      <span className="badge low">Meets all</span>
                    ) : (
                      <span
                        className="badge medium"
                        title={`Fails: ${r.failedCriteria.join(", ")}`}
                      >
                        {r.failedCriteria.length} unmet
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.riskLevel.toLowerCase()}`}>
                      {r.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <WizardNextLink />
    </div>
  );
}
