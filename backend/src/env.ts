import dotenv from "dotenv";

// Must be imported FIRST in server.ts, before any other local module, so
// that process.env.* is populated before those modules read it at
// top-level (e.g. llm.ts computes `client` from process.env.OPENAI_API_KEY
// at import time, not inside a function).
dotenv.config();
