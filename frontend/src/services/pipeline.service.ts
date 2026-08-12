import type { TrialForm } from "../types";
import { apiFetch } from "./api";
import { parseRegionKey } from "../utils/region";

export async function streamRun(form: TrialForm): Promise<Response> {
  const res = await apiFetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...form,
      regions: form.regions.map(parseRegionKey),
    }),
  });
  if (!res.body) {
    throw new Error("Streaming not supported by this browser/response.");
  }
  return res;
}
