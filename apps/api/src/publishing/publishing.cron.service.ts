import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PublishingService } from "./publishing.service";

@Injectable()
export class PublishingCronService {
  constructor(private readonly publishingService: PublishingService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  sweepScheduledJobs() {
    return this.publishingService.sweepScheduledJobs();
  }

  @Cron(CronExpression.EVERY_HOUR)
  refreshTokensSoon() {
    return this.publishingService.refreshTokensSoon();
  }
}
