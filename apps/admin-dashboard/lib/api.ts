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

export function apiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
