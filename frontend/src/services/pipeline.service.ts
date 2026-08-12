import type { TrialForm } from "../types";
import { apiFetch } from "./api";
import { parseRegionKey } from "../utils/region";

/**
 * Start a pipeline run. Returns the raw Response because the backend
 * answers with Server-Sent Events over POST — the caller reads res.body
 * with a stream reader. (EventSource can't send a POST body, which is why
 * this isn't a plain GET.)
 */
export async function streamRun(form: TrialForm): Promise<Response> {
  const res = await apiFetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...form,
      // Expand composite "Region||Country" keys back into
      // {region, country} objects for the backend.
      regions: form.regions.map(parseRegionKey),
    }),
  });
  if (!res.body) {
    throw new Error("Streaming not supported by this browser/response.");
  }
  return res;
}
