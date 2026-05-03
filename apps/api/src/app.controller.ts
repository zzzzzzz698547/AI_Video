import { Controller, Get } from "@nestjs/common";
import { ok } from "./core/http/api-response";
import { OperationsAlertService } from "./shared/operations-alert.service";
import { ObjectStorageService } from "./shared/object-storage.service";

@Controller()
export class AppController {
  constructor(
    private readonly objectStorage: ObjectStorageService,
    private readonly operationsAlert: OperationsAlertService
  ) {}

  @Get()
  root() {
    return ok({
      service: "AI-VIDIO API",
      status: "running",
      docs: {
        web: "http://localhost:3000",
        admin: "http://localhost:3002",
        health: "http://localhost:3001/health",
        metaDeletion: "http://localhost:3001/meta/data-deletion",
        metaDeletionStatus: "http://localhost:3000/meta/data-deletion-status/:code"
      }
    });
  }

  @Get("health")
  health() {
    const storageStatus = this.objectStorage.getStatus();
    const alertStatus = this.operationsAlert.getStatus();
    return ok({
      status: "ok",
      timestamp: new Date().toISOString(),
      readiness: {
        objectStorage: {
          enabled: storageStatus.enabled,
          requireInProduction: storageStatus.requireInProduction,
          publicBaseUrl: storageStatus.publicBaseUrl
        },
        alerts: alertStatus
      }
    });
  }
}
