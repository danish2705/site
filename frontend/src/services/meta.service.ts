import type { MetaResponse } from "../types";
import { apiJson } from "./api";

/** Dropdown options (indications, regions, specialties) fetched once on load. */
export function fetchMeta(): Promise<MetaResponse> {
  return apiJson<MetaResponse>("/api/meta", {
    fallbackError: "Could not load form options",
  });
}
