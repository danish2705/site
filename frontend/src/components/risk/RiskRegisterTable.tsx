import type { RiskRecord } from "../../types";

export default function RiskRegisterTable({
  records,
}: {
  records: RiskRecord[];
}) {
  if (records.length === 0) {
    return <p className="muted">No risk records for this site.</p>;
  }

  // Special highlighted header styling consistent with the app's accent theme
  const thStyle: React.CSSProperties = {
    backgroundColor: "var(--accent-soft)",
    color: "var(--accent-dark)",
    fontWeight: 800,
    position: "sticky",
    top: 0,
    zIndex: 2,
  };

  return (
    <div 
      className="table-scroll" 
      style={{ maxHeight: "360px", overflowY: "auto" }}
    >
      <table>
        <thead>
          <tr>
            <th style={thStyle}>Risk ID</th>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Description</th>
            <th style={thStyle}>Likelihood</th>
            <th style={thStyle}>Impact</th>
            <th style={thStyle}>Overall</th>
            <th style={thStyle}>Owner</th>
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