import { Controller, Get } from "@nestjs/common";
import { ok } from "./core/http/api-response";

@Controller()
export class AppController {
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
    return ok({
      status: "ok",
      timestamp: new Date().toISOString()
    });
  }
}
