import { Injectable, Logger } from "@nestjs/common";

type AlertLevel = "info" | "warn" | "error";

type AlertPayload = {
  level: AlertLevel;
  source: string;
  title: string;
  summary: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class OperationsAlertService {
  private readonly logger = new Logger(OperationsAlertService.name);

  getStatus() {
    const webhookUrl = (process.env.OPERATIONS_ALERT_WEBHOOK_URL ?? "").trim();
    const tokenExpiryHours = Number.parseInt((process.env.SOCIAL_TOKEN_EXPIRY_ALERT_HOURS ?? "72").trim(), 10);
    return {
      webhookConfigured: Boolean(webhookUrl),
      tokenExpiryAlertHours: Number.isFinite(tokenExpiryHours) && tokenExpiryHours > 0 ? tokenExpiryHours : 72
    };
  }

  async notifyPublishingFailure(input: {
    tenantId: string | null;
    publishingJobId?: string | null;
    socialPublishJobId?: string | null;
    platform: string;
    adapterId?: string | null;
    errorMessage: string;
  }) {
    return this.send({
      level: "error",
      source: "publishing",
      title: "Publishing failure detected",
      summary: `平台 ${input.platform} 發布失敗`,
      details: {
        tenantId: input.tenantId,
        publishingJobId: input.publishingJobId ?? null,
        socialPublishJobId: input.socialPublishJobId ?? null,
        adapterId: input.adapterId ?? null,
        errorMessage: input.errorMessage
      }
    });
  }

  async notifyTokenExpiring(input: {
    tenantId: string;
    adapterId: string;
    platform: string;
    accountName: string;
    displayName?: string | null;
    tokenExpiresAt: Date;
    hoursRemaining: number;
  }) {
    return this.send({
      level: "warn",
      source: "social-token",
      title: "Social token expiring soon",
      summary: `平台 ${input.platform} 帳號 ${input.displayName ?? input.accountName} 的 token 即將過期`,
      details: {
        tenantId: input.tenantId,
        adapterId: input.adapterId,
        platform: input.platform,
        accountName: input.accountName,
        displayName: input.displayName ?? null,
        tokenExpiresAt: input.tokenExpiresAt.toISOString(),
        hoursRemaining: input.hoursRemaining
      }
    });
  }

  private async send(payload: AlertPayload) {
    const envelope = {
      app: "ai-vidio-api",
      environment: (process.env.NODE_ENV ?? "development").trim().toLowerCase(),
      timestamp: new Date().toISOString(),
      ...payload
    };

    const serialized = JSON.stringify(envelope);
    if (payload.level === "error") {
      this.logger.error(serialized);
    } else if (payload.level === "warn") {
      this.logger.warn(serialized);
    } else {
      this.logger.log(serialized);
    }

    const webhookUrl = (process.env.OPERATIONS_ALERT_WEBHOOK_URL ?? "").trim();
    if (!webhookUrl) {
      return { delivered: false, reason: "webhook-not-configured" } as const;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: serialized
      });

      if (!response.ok) {
        const raw = await response.text();
        this.logger.warn(`Operations alert webhook responded with ${response.status}: ${raw}`);
        return { delivered: false, reason: `webhook-status-${response.status}` } as const;
      }

      return { delivered: true } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown webhook error";
      this.logger.warn(`Failed to deliver operations alert webhook: ${message}`);
      return { delivered: false, reason: message } as const;
    }
  }
}
