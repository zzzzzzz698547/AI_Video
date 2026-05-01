import { PaginationMeta } from "@ai-vidio/types";

export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    pagination?: PaginationMeta;
  };
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
};

export function ok<T>(data: T, meta?: ApiResponse<T>["meta"]): ApiResponse<T> {
  return {
    success: true,
    data,
    meta
  };
}

export function fail(code: string, message: string, details?: unknown): ApiFailure {
  return {
    success: false,
    error: { code, message, details }
  };
}

