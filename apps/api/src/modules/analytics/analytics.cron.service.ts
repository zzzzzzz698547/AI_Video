import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AnalyticsService } from "./analytics.service";

@Injectable()
export class AnalyticsCronService {
  private readonly logger = new Logger(AnalyticsCronService.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshHourlySignals() {
    this.logger.debug("Refreshing hourly analytics signals");
    await this.analyticsService.refreshDailyReport();
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async refreshDailySignals() {
    this.logger.debug("Refreshing daily analytics optimization rules");
    await this.analyticsService.refreshOptimizationRules();
  }
}
