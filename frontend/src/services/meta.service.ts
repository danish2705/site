import type { MetaResponse } from "../types";
import { apiJson } from "./api";

export function fetchMeta(): Promise<MetaResponse> {
  return apiJson<MetaResponse>("/api/meta", {
    fallbackError: "Could not load form options",
  });
}
