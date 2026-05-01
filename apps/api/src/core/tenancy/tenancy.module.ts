import { Global, Module } from "@nestjs/common";
import { TenancyController } from "./tenancy.controller";
import { TenantLicenseGuard } from "./tenant-license.guard";
import { TenancyService } from "./tenancy.service";

@Global()
@Module({
  controllers: [TenancyController],
  providers: [TenancyService, TenantLicenseGuard],
  exports: [TenancyService, TenantLicenseGuard]
})
export class TenancyModule {}
