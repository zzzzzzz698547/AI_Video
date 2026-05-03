import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { OperationsAlertService } from "../shared/operations-alert.service";
import { TokenEncryptionService } from "../shared/token-encryption.service";
import { FacebookAdapter } from "./facebook.adapter";
import { InstagramAdapter } from "./instagram.adapter";
import { PublishingController } from "./publishing.controller";
import { PublishingCronService } from "./publishing.cron.service";
import { PublishingProcessorService } from "./publishing.processor.service";
import { PublishingQueueService } from "./publishing.queue.service";
import { PublishingService } from "./publishing.service";
import { ThreadsAdapter } from "./threads.adapter";
import { YouTubeAdapter } from "./youtube.adapter";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PublishingController],
  providers: [
    PublishingService,
    PublishingQueueService,
    PublishingProcessorService,
    PublishingCronService,
    OperationsAlertService,
    TokenEncryptionService,
    FacebookAdapter,
    InstagramAdapter,
    ThreadsAdapter,
    YouTubeAdapter
  ]
})
export class PublishingModule {}
