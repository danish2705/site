import dotenv from "dotenv";

dotenv.config();

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigins: list("CORS_ORIGIN"),
  databaseUrl: optional("DATABASE_URL"),

  llm: {
    model:
      optional("AZURE_OPENAI_LLM_DEPLOYMENT") ??
      optional("OPENAI_MODEL") ??
      "gpt-4.1",
    azureEndpoint: optional("AZURE_OPENAI_ENDPOINT"),
    azureKey: optional("AZURE_OPENAI_API_KEY"),
    openaiKey: optional("OPENAI_API_KEY"),
  },

  ctgov: {
    // Set CTGOV_ENABLED=false to fall back to the static Excel values only
    // (e.g. offline dev, or if clinicaltrials.gov is unreachable from your network).
    enabled: optional("CTGOV_ENABLED") !== "false",
    timeoutMs: Number(process.env.CTGOV_TIMEOUT_MS) || 6000,
    cacheTtlMs: Number(process.env.CTGOV_CACHE_TTL_MS) || 6 * 60 * 60 * 1000,
  },
} as const;
