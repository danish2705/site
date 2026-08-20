import type { RiskRecord } from "../../types";

export default function RiskRegisterTable({
  records,
}: {
  records: RiskRecord[];
}) {
  if (records.length === 0) {
    return <p className="muted">No risk records for this site.</p>;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Risk ID</th>
            <th>Category</th>
            <th>Description</th>
            <th>Likelihood</th>
            <th>Impact</th>
            <th>Overall</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            // The "no data" placeholder (liveRiskAssessment.ts) always sets
            // Likelihood/Impact/Overall to "Low" so it fits the RiskLevel
            // type, but that would look identical to a genuinely assessed
            // Low-rated record. Category "Data Availability" only ever
            // comes from that one placeholder, so it's a safe, deterministic
            // way to flag it for a distinct "Unassessed" badge instead.
            const isNoData = r.category === "Data Availability";
            // A record with both Likelihood and Impact at Low reflects no
            // real signal found for this category (e.g. no competing
            // trials nearby, no overdue results) — distinct from a "Low"
            // rating that still came from an actual observed signal. Shown
            // as "No Risk" with the same green treatment as Low.
            const isNoRisk =
              !isNoData && r.likelihood === "Low" && r.impact === "Low";
            return (
              <tr key={r.riskId}>
                <td>{r.riskId}</td>
                <td>{r.category}</td>
                <td className="col-wide">{r.description}</td>
                <td>
                  <span className={`badge ${isNoData ? "no-data" : r.likelihood.toLowerCase()}`}>
                    {isNoData ? "Unassessed" : r.likelihood}
                  </span>
                </td>
                <td>
                  <span className={`badge ${isNoData ? "no-data" : r.impact.toLowerCase()}`}>
                    {isNoData ? "Unassessed" : r.impact}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${isNoData ? "no-data" : isNoRisk ? "no-risk" : r.overallRisk.toLowerCase()}`}
                  >
                    {isNoData
                      ? "Unassessed"
                      : isNoRisk
                        ? "No Risk"
                        : `${r.overallRisk} Risk`}
                  </span>
                </td>
                <td>{r.owner}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
