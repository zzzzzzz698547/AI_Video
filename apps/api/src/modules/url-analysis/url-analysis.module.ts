import { Module } from "@nestjs/common";
import { AiModule } from "../../core/ai/ai.module";
import { UrlAnalysisController } from "./url-analysis.controller";
import { UrlAnalysisService } from "./url-analysis.service";

@Module({
  imports: [AiModule],
  controllers: [UrlAnalysisController],
  providers: [UrlAnalysisService]
})
export class UrlAnalysisModule {}
