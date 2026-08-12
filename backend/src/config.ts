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

  // Browser origins allowed to call this API. Empty = allow any, which is
  // the old behaviour and fine locally; set CORS_ORIGIN in production to
  // your deployed frontend, e.g.
  //   CORS_ORIGIN=https://site-alpha-blush-72.vercel.app
  corsOrigins: list("CORS_ORIGIN"),

  // Optional. Without it the app still runs; saving reports itself as
  // unavailable rather than the server refusing to boot.
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
} as const;
