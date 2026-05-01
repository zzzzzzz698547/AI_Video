import { LicenseKeyStatus, LicensePlan, TenantStatus, TenantUserRole } from "@prisma/client";

export type LicenseLimits = {
  maxUsers: number;
  maxVideos: number;
  maxSocialAccounts: number;
};

export type TenantAccessStatus = {
  tenantId: string;
  tenantName: string;
  status: TenantStatus;
  plan: LicensePlan;
  licenseExpiresAt: string;
  isUsable: boolean;
};

export type TenantMembershipSummary = {
  id: string;
  role: TenantUserRole;
  tenant: TenantAccessStatus;
};

export type LicenseKeySummary = {
  id: string;
  code: string;
  plan: LicensePlan;
  status: LicenseKeyStatus;
  maxUsers: number;
  maxVideos: number;
  maxSocialAccounts: number;
  expiresAt: string;
  activatedAt: string | null;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
};
