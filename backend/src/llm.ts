import OpenAI from "openai";
import type {
  PipelineInput,
  RegionRow,
  RankedSite,
  RecommendationResult,
} from "./types.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
        `[MOCK RESPONSE — no OPENAI_API_KEY set in backend/.env, so GPT-4.1 was not called] ` +
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
