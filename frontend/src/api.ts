const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

/** Absolute URL for a backend path. `apiUrl("/api/meta")`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), options);
}
