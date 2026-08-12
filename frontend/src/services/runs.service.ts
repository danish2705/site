import type { SavedRunDetail, SavedRunSummary } from "../types";
import { apiJson, postJson } from "./api";

/** Persist a completed run. Returns the new run's id. */
export function createRun(payload: unknown): Promise<{ id: string }> {
  return postJson<{ id: string }>("/api/runs", payload, "Save failed");
}

/** Saved runs, newest first. */
export function listRuns(): Promise<SavedRunSummary[]> {
  return apiJson<SavedRunSummary[]>("/api/runs", {
    fallbackError: "Could not load saved runs",
  });
}

/** One saved run with its full ranked-site list. */
export function getRun(id: string): Promise<SavedRunDetail> {
  return apiJson<SavedRunDetail>(`/api/runs/${id}`, {
    fallbackError: "Could not open run",
  });
}
