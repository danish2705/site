import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/httpError.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof Error ? err.message : "Unexpected server error";

  if (status >= 500) console.error("[error]", err);

  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(status).json({ error: message });
};
