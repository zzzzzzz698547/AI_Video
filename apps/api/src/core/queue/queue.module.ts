import { Module } from "@nestjs/common";
import { QUEUE_NAMES } from "./queue-constants";

@Module({
  providers: [{ provide: "QUEUE_NAMES", useValue: QUEUE_NAMES }],
  exports: ["QUEUE_NAMES"]
})
export class QueueModule {}

