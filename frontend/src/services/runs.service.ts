import type { SavedRunDetail, SavedRunSummary } from "../types";
import { apiJson, postJson, apiFetch } from "./api";

export function createRun(payload: unknown): Promise<{ id: string }> {
  return postJson<{ id: string }>("/api/runs", payload, "Save failed");
}

export function listRuns(): Promise<SavedRunSummary[]> {
  return apiJson<SavedRunSummary[]>("/api/runs", {
    fallbackError: "Could not load saved runs",
  });
}


/**
 * Delete a saved run by ID.
 * @throws Error on failure
 */
export async function deleteRun(id: string): Promise<void> {
  const res = await apiFetch(`/api/runs/${id}`, { method: "DELETE" });
  let body: unknown = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    const message = (body as { error?: string })?.error ?? "Delete failed";
    throw new Error(message);
  }
}

export function getRun(id: string): Promise<SavedRunDetail> {
  return apiJson<SavedRunDetail>(`/api/runs/${id}`, {
    fallbackError: "Could not open run",
  });
}
