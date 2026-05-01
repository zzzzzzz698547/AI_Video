import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { fail } from "./api-response";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<any>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse() as unknown;
      const message = this.extractMessage(payload) ?? exception.message ?? "Request failed";
      const details = this.extractDetails(payload);
      const code = this.extractCode(payload, status);

      response.status(status).json(
        fail(code, message, details)
      );
      return;
    }

    const message = exception instanceof Error ? exception.message : "Internal server error";
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      fail("INTERNAL_SERVER_ERROR", message)
    );
  }

  private statusToCode(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "UNPROCESSABLE_ENTITY";
      default:
        return "HTTP_ERROR";
    }
  }

  private extractCode(payload: unknown, status: number) {
    if (payload && typeof payload === "object") {
      const code = (payload as Record<string, unknown>).code;
      if (typeof code === "string" && code.trim()) {
        return code;
      }
    }

    return this.statusToCode(status);
  }

  private extractMessage(payload: unknown) {
    if (typeof payload === "string") {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const record = payload as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message)) {
      return message.map((item) => String(item)).join(", ");
    }

    return null;
  }

  private extractDetails(payload: unknown) {
    if (typeof payload === "string") {
      return undefined;
    }

    if (!payload || typeof payload !== "object") {
      return undefined;
    }

    const { message, error, statusCode, ...rest } = payload as Record<string, unknown>;
    return Object.keys(rest).length > 0 ? rest : { error, statusCode };
  }
}
