import { useMemo, useState } from "react";
import type { RegionOption } from "../../types";
import { regionKey } from "../../utils/region";

// Inline, always-visible multi-select: selected (Region, Country) pairs
// show as removable chips, with a search box and checklist below to add
// more — matching a real product's filter panel rather than a native
// <select multiple> or a popover dropdown.
export default function RegionMultiSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: RegionOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.region} ${o.country}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  function toggle(key: string) {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key]);
  }

  return (
    <div className="region-select">
      {selected.length > 0 && (
        <div className="region-chip-row">
          {selected.map((key) => {
            const [region, country] = key.split("||");
            return (
              <span className="region-chip" key={key}>
                {region}
                {country ? ` — ${country}` : ""}
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-label={`Remove ${region}`}
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <input
        type="text"
        className="region-search"
        placeholder="Search countries/regions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />

      <div className="region-checklist">
        {options.length === 0 ? (
          <div className="dropdown-empty">
            No region/country options for this indication.
          </div>
        ) : filtered.length === 0 ? (
          <div className="dropdown-empty">No matches.</div>
        ) : (
          filtered.map((o) => {
            const key = regionKey(o.region, o.country);
            return (
              <label key={key} className="region-check-option">
                <input
                  type="checkbox"
                  checked={selected.includes(key)}
                  onChange={() => toggle(key)}
                  disabled={disabled}
                />
                {o.region} — {o.country}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
