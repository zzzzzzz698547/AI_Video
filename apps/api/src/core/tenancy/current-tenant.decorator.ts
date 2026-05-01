import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type CurrentTenantPayload = {
  tenantId: string;
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
  plan: "BASIC" | "PRO" | "ENTERPRISE";
  licenseExpiresAt: string;
  remainingDays: number;
  isUsable: boolean;
};

export const CurrentTenant = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ currentTenant?: CurrentTenantPayload }>();
  return request.currentTenant ?? null;
});
