import OpenAI from "openai";
import type {
  PipelineInput,
  RegionRow,
  RankedSite,
  RecommendationResult,
  RegionCandidate,
  RegionPrediction,
  RiskExplanation,
} from "./types.js";

// Supports either a plain OpenAI key (OPENAI_API_KEY) or an Azure OpenAI
// deployment (AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY /
// AZURE_OPENAI_LLM_DEPLOYMENT). Azure takes priority if both are present.
const MODEL =
  process.env.AZURE_OPENAI_LLM_DEPLOYMENT ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1";

const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureKey = process.env.AZURE_OPENAI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

let client: OpenAI | null = null;
if (azureEndpoint && azureKey) {
  // Azure's newer "v1" endpoint (…/openai/v1) is OpenAI-SDK-compatible: point
  // baseURL at it and pass the Azure key both as apiKey and as the "api-key"
  // header Azure expects. `model` in chat.completions.create must be the
  // *deployment name*, not the underlying model name — that's what
  // AZURE_OPENAI_LLM_DEPLOYMENT supplies via MODEL above.
  client = new OpenAI({
    apiKey: azureKey,
    baseURL: azureEndpoint.endsWith("/") ? azureEndpoint : `${azureEndpoint}/`,
    defaultHeaders: { "api-key": azureKey },
  });
} else if (openaiKey) {
  client = new OpenAI({ apiKey: openaiKey });
}

interface RecommendationArgs {
  input: PipelineInput;
  topRegion: RegionRow;
  estimatedPatients: number;
  top: RankedSite;
  riskExplanation: RiskExplanation;
}

// Stage 8 only. Every number that appears in the prompt was already computed
// by the pipeline from the Excel data (Stages 2-7) — the model's job here is
// only to phrase the final recommendation in plain language, not to invent
// or recompute any figures. That now includes explaining WHY the site holds
// its risk rating: the deciding records and the matrix derivation are passed
// in, so the model narrates a real derivation rather than guessing at one.
export async function generateRecommendation({
  input,
  topRegion,
  estimatedPatients,
  top,
  riskExplanation,
}: RecommendationArgs): Promise<RecommendationResult> {
  if (!client) {
    return {
      llm: "mock",
      text:
        `[MOCK RESPONSE — no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY set in backend/.env, so the LLM was not called] ` +
        `Recommended site: ${top.siteName} (${top.siteId}) in ${topRegion.Region}, ${topRegion.Country}. ` +
        `Suitability Score ${top.suitabilityScore}/100, Risk Level: ${top.overallRisk}. ` +
        `${riskExplanation.rule} ${riskExplanation.summary} ` +
        `Preferred based on enrollment history, investigator experience, and overall risk profile.`,
    };
  }

  const driverLines = riskExplanation.drivers
    .map(
      (d) =>
        `- ${d.riskId} [${d.category}, ${d.status}]: ${d.description} — ${d.derivation}`,
    )
    .join("\n");

  const prompt = `You are a clinical trial site-selection assistant. Using ONLY the facts given below
(do not invent or recompute any numbers), write a short 4-5 sentence final recommendation in plain
language. Reference the region, estimated patient population, the top recommended site, its
suitability score, and its risk level.

IMPORTANT: do not just state the risk level — explain WHY the site is rated ${top.overallRisk}.
Use the rating rule and the deciding risk records below, and say whether those records are still
open or already mitigated/closed, since that changes how much the rating should worry the reader.

Trial requirements: ${JSON.stringify(input)}
Selected region: ${topRegion.Region}, ${topRegion.Country}
Estimated eligible patient population: ${estimatedPatients}
Top recommended site: ${top.siteName} (${top.siteId})
Suitability score: ${top.suitabilityScore}/100
Risk level: ${top.overallRisk}

WHY THE RISK LEVEL IS ${top.overallRisk}
Rating rule: ${riskExplanation.rule}
Record mix: ${riskExplanation.totalRecords} record(s) total — ${riskExplanation.highCount} High, ${riskExplanation.mediumCount} Medium, ${riskExplanation.lowCount} Low.
Of the ${riskExplanation.driverTotal} deciding record(s), ${riskExplanation.activeAtLevel} are still Open or being Monitored.
Deciding records:
${driverLines || "- (none on file)"}
Note: each record's own rating comes from a Likelihood x Impact risk matrix, and a site inherits the
worst rating among its records.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  return { llm: MODEL, text: completion.choices[0].message.content ?? "" };
}

interface PredictRegionArgs {
  input: PipelineInput;
  specialty: string;
  candidates: RegionCandidate[];
}

// Strips ```json fences the model sometimes wraps JSON in, so JSON.parse
// doesn't choke on them even when response_format isn't honored.
function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

/**
 * Powers the AI Region Prediction section. The candidate table handed to
 * the model was already computed from the Excel data (prevalence, site
 * counts, suitability, risk density, cost) — the model's job is to weigh
 * those trade-offs against this specific trial's requirements and justify
 * a pick, NOT to invent or recompute figures.
 *
 * Throws on a failed call or unparseable output; the caller
 * (regionPredictor.ts) catches that and falls back to deterministic scoring.
 */
export async function predictRegionWithLLM({
  input,
  specialty,
  candidates,
}: PredictRegionArgs): Promise<RegionPrediction> {
  if (!client) throw new Error("No LLM client configured");

  const prompt = `You are a clinical trial feasibility analyst. Recommend ONE region for this trial.

TRIAL REQUIREMENTS
Indication: ${input.indication}
Required site specialty: ${specialty}
Phase: ${input.phase || "n/a"}
Target sample size: ${input.sampleSize ?? "n/a"}
Planned duration: ${input.durationMonths ?? "n/a"} months
Budget tier: ${input.budgetTier || "n/a"}

CANDIDATE REGIONS (pre-computed from the trial database — every figure below is already
calculated; do NOT recompute, rescale or invent any number, and do NOT propose a region
that is not in this list):
${JSON.stringify(candidates, null, 2)}

Field meanings: estimatedPatients = eligible patients in an assumed 5,000,000-person catchment;
siteCount = candidate sites in the required specialty; avgSuitability / bestSuitability are
0-100 site quality scores; highRiskPerSite = high-severity risk records per site;
monthsToEnroll = estimated months to reach the target sample size at historical enrollment
rates (null = not estimable); score = a weighted composite of all of the above (0-100).

Weigh the trade-offs for THIS trial specifically — e.g. a large phase III needs enrollment
capacity and site depth, a tight duration needs fast regulatory approval, a Low budget tier
needs cost discipline. You may pick a region that is not ranked first if the trade-offs
justify it.

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape:
{
  "region": "<region, copied verbatim from the list>",
  "country": "<country, copied verbatim from the list>",
  "confidence": "Low" | "Medium" | "High",
  "confidenceReason": "<1-2 sentences on WHY this confidence level — e.g. how far clear this region is of the runner-up, or what data gap holds confidence down>",
  "rationale": "<3-4 sentences explaining why this region wins for this trial>",
  "keyFactors": ["<4-5 short bullet phrases, each citing a figure from the data>"],
  "watchOuts": ["<1-3 short bullet phrases naming real risks or limitations of this pick>"],
  "alternatives": [
    { "region": "<name>", "country": "<name>", "why": "<one sentence on when to prefer it instead>" }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<Partial<RegionPrediction>>(raw);

  if (!parsed.region || !parsed.country) {
    throw new Error("LLM response did not name a region/country");
  }

  // Normalize the optional/free-form fields so the frontend can render them
  // without null-guarding every one.
  return {
    region: parsed.region,
    country: parsed.country,
    confidence:
      parsed.confidence === "High" || parsed.confidence === "Low"
        ? parsed.confidence
        : "Medium",
    confidenceReason: parsed.confidenceReason ?? "",
    rationale: parsed.rationale ?? "",
    keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
    watchOuts: Array.isArray(parsed.watchOuts) ? parsed.watchOuts : [],
    alternatives: Array.isArray(parsed.alternatives)
      ? parsed.alternatives.filter((a) => a && a.region && a.country)
      : [],
  };
}

export function llmStatus(): { configured: boolean; model: string } {
  return { configured: !!client, model: MODEL };
}
