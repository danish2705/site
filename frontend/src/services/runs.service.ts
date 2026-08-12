import type { SavedRunDetail, SavedRunSummary } from "../types";
import { apiJson, postJson } from "./api";

export function createRun(payload: unknown): Promise<{ id: string }> {
  return postJson<{ id: string }>("/api/runs", payload, "Save failed");
}

export function listRuns(): Promise<SavedRunSummary[]> {
  return apiJson<SavedRunSummary[]>("/api/runs", {
    fallbackError: "Could not load saved runs",
  });
}

export function getRun(id: string): Promise<SavedRunDetail> {
  return apiJson<SavedRunDetail>(`/api/runs/${id}`, {
    fallbackError: "Could not open run",
  });
}
