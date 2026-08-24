import SiteCombinationPlanner from "../prediction/SiteCombinationPlanner";
import { useSiteMap } from "../../context/SiteMapContext";
import { usePipeline } from "../../hooks/usePipeline";
import WizardNextLink from "../ui/WizardNextLink";

export default function SiteCombinationPlannerPage() {
  const { indication, country, allSites, data } = useSiteMap();
  const { form } = usePipeline();
  const defaultTargetEnrollment =
    typeof form.sampleSize === "number" && form.sampleSize > 0
      ? form.sampleSize
      : undefined;

  if (!country) {
    return (
      <div className="card">
        <p className="predict-placeholder">
          {data
            ? "No country resolved for the current search — pick a region/country in Step 1 (or apply an AI prediction), then revisit this page."
            : "No search yet — run a search from the Site Map (Global) page, with a country resolved from Step 1's region selection, to use the combination planner."}
        </p>
        <WizardNextLink />
      </div>
    );
  }

  return (
    <SiteCombinationPlanner
      indication={indication}
      country={country}
      sites={allSites}
      defaultTargetEnrollment={defaultTargetEnrollment}
    />
  );
}