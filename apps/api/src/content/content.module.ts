import { Module } from "@nestjs/common";
import { ContentController } from "./content.controller";
import { ContentGeneratorService } from "./content-generator.service";
import { ContentService } from "./content.service";

@Module({
  controllers: [ContentController],
  providers: [ContentService, ContentGeneratorService],
  exports: [ContentGeneratorService]
})
export class ContentModule {}
