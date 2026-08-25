import SiteCombinationPlanner from "../prediction/SiteCombinationPlanner";
import { useIndependentSiteSearch } from "../../hooks/useIndependentSiteSearch";
import { usePipeline } from "../../hooks/usePipeline";

export default function SiteCombinationPlannerPage() {
  const {
    indication,
    country,
    setCountry,
    selectedCountries,
    runSearch,
    loading,
    allSites,
  } = useIndependentSiteSearch();
  const { form } = usePipeline();
  const defaultTargetEnrollment =
    typeof form.sampleSize === "number" && form.sampleSize > 0
      ? form.sampleSize
      : undefined;

  return (
    <SiteCombinationPlanner
      indication={indication}
      country={country}
      selectedCountries={selectedCountries}
      onCountryChange={setCountry}
      onSearchCountry={runSearch}
      countrySearchLoading={loading}
      sites={allSites}
      defaultTargetEnrollment={defaultTargetEnrollment}
    />
  );
}
