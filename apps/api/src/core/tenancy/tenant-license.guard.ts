import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { CurrentTenantPayload } from "./current-tenant.decorator";
import { TenancyService } from "./tenancy.service";

@Injectable()
export class TenantLicenseGuard implements CanActivate {
  constructor(private readonly tenancyService: TenancyService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
      route?: { path?: string };
      originalUrl?: string;
      currentTenant?: CurrentTenantPayload | null;
    }>();

    const currentTenant = await this.tenancyService.resolveTenantAccessFromRequest({
      body: request.body,
      query: request.query,
      params: request.params,
      routePath: request.route?.path,
      originalUrl: request.originalUrl
    });

    request.currentTenant = currentTenant;
    return true;
  }
}
