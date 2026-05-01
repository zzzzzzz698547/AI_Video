import { ForbiddenException } from "@nestjs/common";

type TenantLicenseErrorCode = "LICENSE_EXPIRED" | "TENANT_SUSPENDED" | "TENANT_INACTIVE";

export class TenantLicenseException extends ForbiddenException {
  constructor(
    code: TenantLicenseErrorCode,
    message: string,
    details?: {
      tenantId?: string;
      tenantStatus?: string;
      licenseExpiresAt?: string | null;
      remainingDays?: number;
    }
  ) {
    super({
      code,
      message,
      ...details
    });
  }
}
