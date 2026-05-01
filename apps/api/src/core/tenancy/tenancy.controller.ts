import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ActivateLicenseKeyDto } from "./dto/activate-license-key.dto";
import { GenerateLicenseKeyDto } from "./dto/generate-license-key.dto";
import { TenancyService } from "./tenancy.service";

@Controller("tenancy")
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

  @Post("license-keys/generate")
  generateLicenseKeys(@Body() dto: GenerateLicenseKeyDto) {
    return this.tenancyService.generateLicenseKeys(dto);
  }

  @Post("license-keys/activate")
  activateLicenseKey(@Body() dto: ActivateLicenseKeyDto) {
    return this.tenancyService.activateLicenseKey(dto);
  }

  @Get("users/:userId/status")
  getUserTenantStatus(@Param("userId") userId: string) {
    return this.tenancyService.getUserTenantStatus(userId);
  }

  @Get("tenants/:tenantId")
  getTenant(@Param("tenantId") tenantId: string) {
    return this.tenancyService.getTenant(tenantId);
  }

  @Get("tenants/:tenantId/license-status")
  getTenantLicenseStatus(@Param("tenantId") tenantId: string) {
    return this.tenancyService.getTenantLicenseStatus(tenantId);
  }
}
