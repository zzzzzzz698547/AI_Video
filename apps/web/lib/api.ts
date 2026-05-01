function normalizeBaseUrl(value?: string) {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/^["'\s\\]+/, "")
    .replace(/["'\s\\]+$/, "")
    .replace(/\/+$/, "");
}

function resolveApiBaseUrl() {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001";
    }
  }

  return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) || "http://localhost:3001";
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string; details?: unknown }; message?: string };
        const message = parsed.error?.message ?? parsed.message;
        if (message) {
          throw new Error(message);
        }
      } catch {
        throw new Error(`API ${response.status} ${path}: ${raw}`);
      }
    }

    throw new Error(`API ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}
