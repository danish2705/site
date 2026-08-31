interface EligibilityData {
  criteriaText: string | null;
  sex: string | null;
  minimumAge: string | null;
  maximumAge: string | null;
  healthyVolunteers: boolean | null;
  sourceNctId: string | null;
}

interface Stage1Data {
  indication?: string;
  eligibility?: EligibilityData;
}

export default function EligibilityCriteriaCard({
  data,
}: {
  data: unknown;
}) {
  const stage1 = data as Stage1Data | null;
  const eligibility = stage1?.eligibility;

  if (!eligibility) return null;

  const hasAnyField =
    eligibility.criteriaText ||
    eligibility.sex ||
    eligibility.minimumAge ||
    eligibility.maximumAge ||
    eligibility.healthyVolunteers !== null;

  if (!hasAnyField) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="predict-title">Inclusion / Exclusion Criteria</span>
          </div>
        </div>
        <p className="section-hint">
          No trial for {stage1?.indication ?? "this indication"} on
          ClinicalTrials.gov currently discloses eligibility criteria text —
          nothing to show.
        </p>
      </div>
    );
  }

  return (
    <details className="card" style={{ marginTop: 16, padding: 16 }}>
      <summary style={{ cursor: "pointer" }}>
        <span className="predict-title">Inclusion / Exclusion Criteria</span>{" "}
        <span className="chip live-chip" style={{ marginLeft: 8 }}>
          live
        </span>
        {eligibility.sourceNctId && (
          <span className="chip" style={{ marginLeft: 6 }}>
            {eligibility.sourceNctId}
          </span>
        )}
      </summary>

      <p className="section-hint" style={{ marginTop: 10 }}>
        Real, disclosed eligibility criteria from one representative
        {" "}
        {stage1?.indication ?? ""} trial on ClinicalTrials.gov — shown for
        reference only. It is not applied to filter any eligible-patient
        count elsewhere in this app.
      </p>

      <div className="final-grid" style={{ marginTop: 8 }}>
        <div className="item">
          <div className="k">Sex</div>
          <div className="v">{eligibility.sex ?? "N/A"}</div>
        </div>
        <div className="item">
          <div className="k">Minimum age</div>
          <div className="v">{eligibility.minimumAge ?? "N/A"}</div>
        </div>
        <div className="item">
          <div className="k">Maximum age</div>
          <div className="v">{eligibility.maximumAge ?? "N/A"}</div>
        </div>
        <div className="item">
          <div className="k">Accepts healthy volunteers</div>
          <div className="v">
            {eligibility.healthyVolunteers === null
              ? "N/A"
              : eligibility.healthyVolunteers
                ? "Yes"
                : "No"}
          </div>
        </div>
      </div>

      {eligibility.criteriaText && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            marginTop: 12,
            fontFamily: "inherit",
            fontSize: 13,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {eligibility.criteriaText}
        </pre>
      )}
    </details>
  );
}
