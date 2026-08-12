import type { Request, Response } from "express";
import { runPipeline } from "../pipeline/runPipeline.js";
import type { PipelineInput } from "../types.js";

export async function postRun(req: Request, res: Response): Promise<void> {
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
}
