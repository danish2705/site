import { INDICATION_TO_SPECIALTY } from "../repository/excelStore.js";
import { inferSpecialtyForIndication } from "../llm/client.js";

const inferredSpecialtyCache = new Map<string, string>();

export async function resolveSpecialty(indication: string): Promise<string> {
  const staticMatch = INDICATION_TO_SPECIALTY[indication];
  if (staticMatch) return staticMatch;

  const cached = inferredSpecialtyCache.get(indication.toLowerCase());
  if (cached) return cached;

  try {
    const specialty = await inferSpecialtyForIndication(indication);
    inferredSpecialtyCache.set(indication.toLowerCase(), specialty);
    return specialty;
  } catch (err) {
    throw new Error(
      `Could not determine the required specialty for indication "${indication}": ` +
        `it isn't in the static specialty map, and the LLM-based fallback failed ` +
        `(${(err as Error).message}). Configure an LLM (OPENAI_API_KEY or ` +
        `AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY) or pick an indication from the static list.`,
    );
  }
}
