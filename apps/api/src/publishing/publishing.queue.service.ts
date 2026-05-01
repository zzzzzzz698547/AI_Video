import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";
import { PublishingProcessorService } from "./publishing.processor.service";
import { QueueState } from "@prisma/client";

@Injectable()
export class PublishingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublishingQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private enableBullMq = false;

  constructor(private readonly prisma: PrismaService, private readonly processor: PublishingProcessorService) {}

  async onModuleInit() {
    const connection = this.getConnection();
    if (!connection) {
      this.logger.log("REDIS_URL not configured. Using cron-driven publishing fallback for local development.");
      return;
    }

    const redisVersion = await this.getRedisVersion(connection.url);
    if (!redisVersion) {
      this.logger.warn("Redis version could not be detected. Using cron-driven publishing fallback.");
      return;
    }

    if (this.isVersionLessThan(redisVersion, "5.0.0")) {
      this.logger.warn(
        `Redis ${redisVersion} is below BullMQ minimum 5.0.0. Using cron-driven publishing fallback.`
      );
      return;
    }

    this.queue = new Queue("publishing", { connection });
    this.worker = new Worker(
      "publishing",
      async (job: Job<{ publishingJobId: string }>) => {
        await this.processor.process(job.data.publishingJobId, "bullmq");
      },
      { connection, concurrency: 4 }
    );
    this.enableBullMq = true;

    this.worker.on("failed", (job, error) => {
      if (!job) return;
      void this.prisma.publishQueue.updateMany({
        where: { publishingJobId: job.data.publishingJobId },
        data: { queueState: QueueState.FAILED }
      });
      this.logger.error(`Publishing job ${job.data.publishingJobId} failed`, error);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  isReady() {
    return this.enableBullMq;
  }

  async enqueue(publishingJobId: string, delayMs = 0) {
    if (!this.queue) {
      await this.prisma.publishQueue.upsert({
        where: { publishingJobId },
        create: {
          publishingJobId,
          queueName: "publishing",
          queueState: QueueState.PENDING,
          scheduledFor: delayMs ? new Date(Date.now() + delayMs) : null
        },
        update: {
          queueState: QueueState.PENDING,
          scheduledFor: delayMs ? new Date(Date.now() + delayMs) : null
        }
      });

      if (delayMs <= 0) {
        await this.processor.process(publishingJobId, "manual");
      }
      return null;
    }

    const job = await this.queue.add(
      "publishing-job",
      { publishingJobId },
      {
        delay: Math.max(0, delayMs),
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    await this.prisma.publishQueue.upsert({
      where: { publishingJobId },
      create: {
        publishingJobId,
        queueName: "publishing",
        bullJobId: job.id,
        queueState: delayMs > 0 ? QueueState.PENDING : QueueState.ENQUEUED,
        scheduledFor: delayMs > 0 ? new Date(Date.now() + delayMs) : null
      },
      update: {
        bullJobId: job.id,
        queueState: delayMs > 0 ? QueueState.PENDING : QueueState.ENQUEUED,
        scheduledFor: delayMs > 0 ? new Date(Date.now() + delayMs) : null
      }
    });

    return job.id;
  }

  private getConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return null;
    }

    return { url: redisUrl };
  }

  private async getRedisVersion(url: string) {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });

    try {
      await client.connect();
      const info = await client.info("server");
      const versionLine = info
        .split("\n")
        .find((line) => line.toLowerCase().startsWith("redis_version:"));
      const version = versionLine?.split(":")[1]?.trim() ?? null;
      return version;
    } catch (error) {
      this.logger.warn(`Failed to probe Redis version: ${(error as Error).message}`);
      return null;
    } finally {
      await client.quit().catch(() => undefined);
    }
  }

  private isVersionLessThan(current: string, required: string) {
    const parse = (value: string) => value.split(".").map((part) => Number.parseInt(part, 10) || 0);
    const [currentMajor, currentMinor, currentPatch] = parse(current);
    const [requiredMajor, requiredMinor, requiredPatch] = parse(required);

    if (currentMajor !== requiredMajor) {
      return currentMajor < requiredMajor;
    }

    if (currentMinor !== requiredMinor) {
      return currentMinor < requiredMinor;
    }

    return currentPatch < requiredPatch;
  }
}
