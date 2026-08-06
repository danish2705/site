import "./env.js"; // must be the first import — loads .env before any module below reads process.env at import time
import express, { type Request, type Response } from "express";
import cors from "cors";
import { loadStore, INDICATION_TO_SPECIALTY } from "./excelStore.js";
import { runPipeline } from "./pipeline.js";
import { predictRegion } from "./regionPredictor.js";
import { llmStatus } from "./llm.js";
import {
  saveRun,
  listRuns,
  getRun,
  deleteRun,
  dbStatus,
  dbPing,
  type SaveRunInput,
} from "./db.js";
import type { PipelineInput } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const store = loadStore();
    res.json({
      ok: true,
      excelFile: store.filePath,
      sites: store.sites.length,
      riskRecords: store.risks.length,
      llm: llmStatus(),
      db: { ...dbStatus(), ...(await dbPing()) },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// Frontend calls this once on load to populate the indication dropdown, etc.
app.get("/api/meta", (_req: Request, res: Response) => {
  try {
    const store = loadStore();
    res.json({
      indications: store.indications,
      regions: store.regions,
      // Selectable (Indication, Region, Country) combos for the Region /
      // Country Selection input (multi-select) on the frontend form.
      regionOptions: store.regionOptions,
      specialties: INDICATION_TO_SPECIALTY,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Powers the frontend's "AI Region Prediction" section. Separate from
// /api/run on purpose: it's a single fast request/response (no SSE, no
// 8-stage walk) that the user can fire on its own to get a suggested
// region *before* deciding what to feed the pipeline.
app.post("/api/predict-region", async (req: Request, res: Response) => {
  try {
    const result = await predictRegion((req.body || {}) as PipelineInput);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Streams pipeline progress as Server-Sent Events over a single POST request.
// The frontend reads this with fetch() + a manual stream reader (EventSource
// can't send a POST body, which is why this isn't a plain GET+EventSource).
app.post("/api/run", async (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runPipeline((req.body || {}) as PipelineInput, send);
    send("done", {});
  } catch (err) {
    send("error", { message: (err as Error).message });
  }
  res.end();
});

// ---- Saved runs (Supabase) ------------------------------------------
// The browser never talks to Supabase directly: db.ts holds a service-role
// key that bypasses RLS and must not reach the bundle. These endpoints are
// the only way in.

// Persist a completed pipeline run.
app.post("/api/runs", async (req: Request, res: Response) => {
  try {
    const saved = await saveRun((req.body || {}) as SaveRunInput);
    res.status(201).json(saved);
  } catch (err) {
    // 503, not 400: an unconfigured Supabase is a server-side gap, not a
    // malformed request, and the frontend shows the two differently.
    const message = (err as Error).message;
    res.status(dbStatus().configured ? 400 : 503).json({ error: message });
  }
});

// List saved runs, newest first.
app.get("/api/runs", async (_req: Request, res: Response) => {
  try {
    res.json(await listRuns());
  } catch (err) {
    res
      .status(dbStatus().configured ? 500 : 503)
      .json({ error: (err as Error).message });
  }
});

// One saved run with its full ranked-site list.
app.get("/api/runs/:id", async (req: Request, res: Response) => {
  try {
    res.json(await getRun(String(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

app.delete("/api/runs/:id", async (req: Request, res: Response) => {
  try {
    await deleteRun(String(req.params.id));
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  try {
    const store = loadStore();
    console.log(
      `Loaded ${store.sites.length} sites, ${store.risks.length} risk records from ${store.filePath}`,
    );
  } catch (err) {
    console.error(
      "WARNING: failed to load Excel data at startup:",
      (err as Error).message,
    );
  }
});
