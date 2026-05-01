import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { MetaDataDeletionController } from "./meta-data-deletion.controller";
import { MetaDataDeletionService } from "./meta-data-deletion.service";

@Module({
  imports: [PrismaModule],
  controllers: [MetaDataDeletionController],
  providers: [MetaDataDeletionService],
  exports: [MetaDataDeletionService]
})
export class MetaDataDeletionModule {}
