import SiteCombinationPlanner from "../prediction/SiteCombinationPlanner";
import { useSiteMap } from "../../context/SiteMapContext";

/**
 * "Site Combination Planner" page — thin wrapper around the existing,
 * unchanged SiteCombinationPlanner component. It used to render inline at
 * the bottom of the Site Map tab, gated on a country being resolved; that
 * same gate is preserved here, just as its own dedicated page reachable
 * from the workflow nav instead of a scroll-down section.
 */
export default function SiteCombinationPlannerPage() {
  const { indication, country, allSites, data } = useSiteMap();

  if (!country) {
    return (
      <div className="card">
        <div className="predict-head-top">
          <div className="predict-head-text">
            <span className="predict-title">Site Combination Planner</span>
          </div>
        </div>
        <p className="predict-placeholder">
          {data
            ? "No country resolved for the current search — pick a region/country in Step 1 (or apply an AI prediction), then revisit this page."
            : "No search yet — run a search from the Site Map (Global) page, with a country resolved from Step 1's region selection, to use the combination planner."}
        </p>
      </div>
    );
  }

  return (
    <SiteCombinationPlanner
      indication={indication}
      country={country}
      sites={allSites}
    />
  );
}
