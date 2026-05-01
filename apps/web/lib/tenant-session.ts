export const TENANT_SESSION_KEY = "ai-vidio-tenant-session";

export type TenantSession = {
  tenantId: string;
  tenantName: string;
  tenantStatus?: "ACTIVE" | "EXPIRED" | "SUSPENDED";
  plan: "BASIC" | "PRO" | "ENTERPRISE";
  licenseExpiresAt: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userId: string;
  userEmail: string;
  userName: string;
};

export function readTenantSession(): TenantSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(TENANT_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as TenantSession;
  } catch {
    window.localStorage.removeItem(TENANT_SESSION_KEY);
    return null;
  }
}

export function writeTenantSession(session: TenantSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TENANT_SESSION_KEY, JSON.stringify(session));
}

export function updateTenantSession(patch: Partial<TenantSession>) {
  const current = readTenantSession();
  if (!current) {
    return;
  }

  writeTenantSession({
    ...current,
    ...patch
  });
}

export function clearTenantSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(TENANT_SESSION_KEY);
}

export function isTenantSessionExpired(session: TenantSession | null) {
  if (!session) {
    return true;
  }

  return new Date(session.licenseExpiresAt).getTime() <= Date.now();
}

export function getTenantRemainingDays(session: TenantSession | null) {
  if (!session) {
    return 0;
  }

  const diff = new Date(session.licenseExpiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
