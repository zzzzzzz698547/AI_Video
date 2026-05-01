import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { DomainEventBusService } from "./events/domain-event-bus.service";
import { IntegrationsModule } from "./integrations/integrations.module";
import { MetaDataDeletionModule } from "./meta-data-deletion/meta-data-deletion.module";
import { QueueModule } from "./queue/queue.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { UsersModule } from "./users/users.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    WorkspaceModule,
    IntegrationsModule,
    MetaDataDeletionModule,
    QueueModule,
    SchedulerModule,
    AiModule,
    TenancyModule
  ],
  providers: [DomainEventBusService],
  exports: [DomainEventBusService, QueueModule, SchedulerModule, AiModule, TenancyModule]
})
export class CoreModule {}
