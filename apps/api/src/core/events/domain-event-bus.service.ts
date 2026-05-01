import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { DomainEvent } from "@ai-vidio/types";

@Injectable()
export class DomainEventBusService {
  private readonly emitter = new EventEmitter();

  emit<TPayload>(event: DomainEvent<TPayload>) {
    this.emitter.emit(event.name, event);
  }

  on<TPayload>(eventName: string, handler: (event: DomainEvent<TPayload>) => void) {
    this.emitter.on(eventName, handler as never);
  }
}

