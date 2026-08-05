import OpenAI from "openai";
import type {
  PipelineInput,
  RegionRow,
  RankedSite,
  RecommendationResult,
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
}

// Stage 8 only. Every number that appears in the prompt was already computed
// by the pipeline from the Excel data (Stages 2-7) — the model's job here is
// only to phrase the final recommendation in plain language, not to invent
// or recompute any figures.
export async function generateRecommendation({
  input,
  topRegion,
  estimatedPatients,
  top,
}: RecommendationArgs): Promise<RecommendationResult> {
  if (!client) {
    return {
      llm: "mock",
      text:
        `[MOCK RESPONSE — no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY set in backend/.env, so the LLM was not called] ` +
        `Recommended site: ${top.siteName} (${top.siteId}) in ${topRegion.Region}, ${topRegion.Country}. ` +
        `Suitability Score ${top.suitabilityScore}/100, Risk Level: ${top.overallRisk}. ` +
        `Preferred based on enrollment history, investigator experience, and overall risk profile.`,
    };
  }

  const prompt = `You are a clinical trial site-selection assistant. Using ONLY the facts given below
(do not invent or recompute any numbers), write a short 3-4 sentence final recommendation in plain
language. Reference the region, estimated patient population, the top recommended site, its
suitability score, and its risk level.

Trial requirements: ${JSON.stringify(input)}
Selected region: ${topRegion.Region}, ${topRegion.Country}
Estimated eligible patient population: ${estimatedPatients}
Top recommended site: ${top.siteName} (${top.siteId})
Suitability score: ${top.suitabilityScore}/100
Risk level: ${top.overallRisk}
High-risk record count for this site: ${top.highRiskCount}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  return { llm: MODEL, text: completion.choices[0].message.content ?? "" };
}

export function llmStatus(): { configured: boolean; model: string } {
  return { configured: !!client, model: MODEL };
}
