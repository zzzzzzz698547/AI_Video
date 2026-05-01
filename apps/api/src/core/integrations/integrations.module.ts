import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { TokenEncryptionService } from "../../shared/token-encryption.service";
import { SocialModule } from "../../social/social.module";

@Module({
  imports: [SocialModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, TokenEncryptionService],
  exports: [IntegrationsService]
})
export class IntegrationsModule {}
