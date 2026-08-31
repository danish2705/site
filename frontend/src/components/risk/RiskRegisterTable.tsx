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
            const isNoData = r.category === "Data Availability";
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
