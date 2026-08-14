export interface RegionDefinition {
  region: string;
  country: string;
}

// Code-level geography grouping — not sourced from Excel or any live API,
// since sub-national "region" labels like "South India" are this app's own
// taxonomy, not something any public data source defines. Extend this list
// as needed; it is the single place region/country options are defined now
// that Region_Data.xlsx is no longer used.
export const REGION_DEFINITIONS: RegionDefinition[] = [
  { region: "South India", country: "India" },
  { region: "North India", country: "India" },
  { region: "West India", country: "India" },
  { region: "East India", country: "India" },
  { region: "North Africa", country: "Egypt" },
  { region: "West Africa", country: "Nigeria" },
  { region: "East Africa", country: "Kenya" },
  { region: "Southern Africa", country: "South Africa" },
  { region: "South-East Asia", country: "Philippines" },
  { region: "South-East Asia", country: "Vietnam" },
  { region: "South-East Asia", country: "Indonesia" },
  { region: "East Asia", country: "South Korea" },
  { region: "East Asia", country: "Japan" },
  { region: "East Asia", country: "China" },
  { region: "East Asia", country: "Taiwan" },
  { region: "Andean Region", country: "Colombia" },
  { region: "Andean Region", country: "Peru" },
  { region: "Southern Cone", country: "Argentina" },
  { region: "Southern Cone", country: "Chile" },
  { region: "North America", country: "United States" },
  { region: "North America", country: "Canada" },
  { region: "Western Europe", country: "United Kingdom" },
  { region: "Western Europe", country: "France" },
  { region: "Western Europe", country: "Germany" },
  { region: "Western Europe", country: "Spain" },
  { region: "Western Europe", country: "Italy" },
  { region: "Western Europe", country: "Netherlands" },
  { region: "Northern Europe", country: "Sweden" },
  { region: "Eastern Europe", country: "Poland" },
  { region: "Eastern Europe", country: "Czech Republic" },
  { region: "Eastern Europe", country: "Romania" },
  { region: "Middle East", country: "Israel" },
  { region: "Middle East", country: "United Arab Emirates" },
  { region: "Middle East", country: "Saudi Arabia" },
  { region: "South Asia", country: "Bangladesh" },
  { region: "South Asia", country: "Sri Lanka" },
  { region: "South Asia", country: "Pakistan" },
  { region: "Oceania", country: "Australia" },
];
