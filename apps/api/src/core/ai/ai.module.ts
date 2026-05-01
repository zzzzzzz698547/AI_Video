import { Module } from "@nestjs/common";
import { AiOrchestratorService } from "./ai-orchestrator.service";
import { AiProviderBindingsController } from "./ai-provider-bindings.controller";
import { AiProviderBindingsService } from "./ai-provider-bindings.service";
import { TokenEncryptionService } from "../../shared/token-encryption.service";

@Module({
  controllers: [AiProviderBindingsController],
  providers: [AiOrchestratorService, AiProviderBindingsService, TokenEncryptionService],
  exports: [AiOrchestratorService, AiProviderBindingsService]
})
export class AiModule {}
