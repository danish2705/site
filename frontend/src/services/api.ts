const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

/** Absolute URL for a backend path. `apiUrl("/api/meta")`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * fetch with the backend origin prefixed. Returns the raw Response — used
 * directly by the SSE run stream, which reads `res.body` rather than JSON.
 */
export function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), options);
}

/**
 * JSON request that throws on a non-2xx. The backend reports failures as
 * `{ error: string }`, so surface that message when present and fall back
 * to a caller-supplied one otherwise.
 */
export async function apiJson<T>(
  path: string,
  options?: RequestInit & { fallbackError?: string },
): Promise<T> {
  const { fallbackError, ...init } = options ?? {};
  const res = await apiFetch(path, init);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ??
      fallbackError ??
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

/** POST helper — the JSON body and content-type in one place. */
export function postJson<T>(
  path: string,
  payload: unknown,
  fallbackError?: string,
): Promise<T> {
  return apiJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    fallbackError,
  });
}
