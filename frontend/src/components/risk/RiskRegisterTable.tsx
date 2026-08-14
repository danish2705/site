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
            <th>Status</th>
            <th>Mitigation Plan</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.riskId}>
              <td>{r.riskId}</td>
              <td>{r.category}</td>
              <td className="col-wide">{r.description}</td>
              <td>
                <span className={`badge ${r.likelihood.toLowerCase()}`}>
                  {r.likelihood}
                </span>
              </td>
              <td>
                <span className={`badge ${r.impact.toLowerCase()}`}>
                  {r.impact}
                </span>
              </td>
              <td>
                <span className={`badge ${r.overallRisk.toLowerCase()}`}>
                  {r.overallRisk} Risk
                </span>
              </td>
              <td>{r.status}</td>
              <td className="col-wide">{r.mitigationPlan}</td>
              <td>{r.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
