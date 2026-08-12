const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), options);
}

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
