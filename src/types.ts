import type { ZodSchema } from "zod";

// ── Modes ──────────────────────────────────────────────
export type InterceptorMode = "observe" | "warn" | "strict";

// ── Route schema definition ───────────────────────────
export interface RouteSchema {
  request?: ZodSchema;
  response?: ZodSchema;
}

// ── Config the user passes to createInterceptor ───────
export interface InterceptorConfig {
  mode?: InterceptorMode;
  routes: Record<string, RouteSchema>;
  redact?: string[];
  destinations?: Destination[];
  dashboardPort?: number;
}

export type Destination = "console" | "memory" | "dashboard";

// ── Validation result returned per field ──────────────
export interface FieldError {
  path: (string | number)[];
  expected: string;
  received: string;
  message: string;
}

// ── A single log entry ───────────────────────────────
export interface LogEntry {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  routePattern: string;
  direction: "request" | "response";
  valid: boolean;
  errors: FieldError[];
  data: Record<string, unknown>;
  mode: InterceptorMode;
  statusCode?: number;
}

// ── Validation outcome ───────────────────────────────
export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  log: LogEntry;
}
