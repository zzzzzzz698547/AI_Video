export type AdminSession = {
  username: string;
  displayName: string;
  role: "SUPER_ADMIN";
  token: string;
  expiresAt: string;
};

const STORAGE_KEY = "ai-vidio-admin-session";

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function writeAdminSession(session: AdminSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function isAdminSessionExpired(session: AdminSession) {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}
