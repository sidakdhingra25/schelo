/**
 * api-schema-interceptor
 *
 * Validate API request/response payloads against Zod schemas.
 * Log mismatches, redact sensitive fields, and optionally throw.
 *
 * Usage:
 *   import { createInterceptor } from "api-schema-interceptor"
 *   const interceptor = createInterceptor({ ... })
 *   interceptor.enable()
 */

export { SchemaInterceptor } from "./registry";
export { logStore } from "./log-store";
export { enableAxios } from "./adapters/axios";
export type {
  InterceptorConfig,
  InterceptorMode,
  RouteSchema,
  LogEntry,
  ValidationResult,
  FieldError,
  Destination,
} from "./types";

import type { InterceptorConfig } from "./types";
import { SchemaInterceptor } from "./registry";

/**
 * Create a new interceptor from a config object.
 */
export function createInterceptor(config: InterceptorConfig): SchemaInterceptor {
  return new SchemaInterceptor(config);
}
