import type { RouteSchema, InterceptorConfig, InterceptorMode, Destination, ValidationResult, LogEntry, FieldError } from "./types";
import { matchRoute, parseRouteKey } from "./path-matcher";
import { validate } from "./validator";
import { redact } from "./redactor";
import { logStore } from "./log-store";

let idCounter = 0;
function nextId(): string {
  return `log_${Date.now()}_${++idCounter}`;
}

/**
 * The core interceptor instance returned by createInterceptor().
 */
export class SchemaInterceptor {
  private routes: Map<string, RouteSchema> = new Map();
  public mode: InterceptorMode;
  private redactKeys: string[];
  private destinations: Destination[];
  private _enabled = false;
  private _originalFetch: typeof globalThis.fetch | null = null;

  constructor(config: InterceptorConfig) {
    this.mode = config.mode ?? "observe";
    this.redactKeys = config.redact ?? [];
    this.destinations = config.destinations ?? ["console", "memory"];

    for (const [key, schema] of Object.entries(config.routes)) {
      this.routes.set(key, schema);
    }
  }

  // ── Route registration at runtime ──────────────────
  register(routeKey: string, schema: RouteSchema) {
    this.routes.set(routeKey, schema);
  }

  unregister(routeKey: string) {
    this.routes.delete(routeKey);
  }

  getRegisteredRoutes(): string[] {
    return [...this.routes.keys()];
  }

  // ── Validate request or response data ──────────────
  validateRequest(method: string, url: string, body: unknown): ValidationResult {
    return this.runValidation(method, url, body, "request");
  }

  validateResponse(method: string, url: string, body: unknown, statusCode?: number): ValidationResult {
    return this.runValidation(method, url, body, "response", statusCode);
  }

  private runValidation(
    method: string,
    url: string,
    body: unknown,
    direction: "request" | "response",
    statusCode?: number
  ): ValidationResult {
    const routeKeys = [...this.routes.keys()];
    const match = matchRoute(method, url, routeKeys);

    const { method: parsedMethod, pattern } = match
      ? parseRouteKey(match.routeKey)
      : { method: method.toUpperCase(), pattern: url };

    let errors: FieldError[] = [];
    if (match) {
      const schema = this.routes.get(match.routeKey);
      const zodSchema = direction === "request" ? schema?.request : schema?.response;
      if (zodSchema) {
        errors = validate(zodSchema, body);
      }
    }

    const safeData = this.redactKeys.length
      ? redact(body, this.redactKeys)
      : (body as Record<string, unknown>) ?? {};

    const entry: LogEntry = {
      id: nextId(),
      timestamp: Date.now(),
      method: parsedMethod,
      path: url,
      routePattern: match ? `${parsedMethod} ${pattern}` : `${parsedMethod} ${url}`,
      direction,
      valid: errors.length === 0,
      errors,
      data: typeof safeData === "object" && safeData !== null ? safeData as Record<string, unknown> : {},
      mode: this.mode,
      statusCode,
    };

    logStore.push(entry, this.destinations, this.mode);

    // strict mode throws on validation failure
    if (!entry.valid && this.mode === "strict") {
      const msg = errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`[api-interceptor] Schema violation on ${method} ${url}: ${msg}`);
    }

    return { valid: entry.valid, errors, log: entry };
  }

  // ── Global fetch interception ──────────────────────
  enable() {
    if (this._enabled) return;
    if (typeof globalThis.fetch === "undefined") return;

    this._originalFetch = globalThis.fetch;
    const self = this;

    globalThis.fetch = async function interceptedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      const method = init?.method ?? "GET";

      // validate request body
      if (init?.body) {
        try {
          const parsed = JSON.parse(
            typeof init.body === "string" ? init.body : new TextDecoder().decode(init.body as ArrayBuffer)
          );
          self.validateRequest(method, url, parsed);
        } catch {
          // non-JSON body or parsing error — skip validation
        }
      }

      // call original fetch
      const response = await self._originalFetch!.call(globalThis, input, init);

      // clone response so we can read body without consuming it
      const clone = response.clone();
      try {
        const responseData = await clone.json();
        self.validateResponse(method, url, responseData, response.status);
      } catch {
        // non-JSON response — skip validation
      }

      return response;
    };

    this._enabled = true;
  }

  disable() {
    if (!this._enabled || !this._originalFetch) return;
    globalThis.fetch = this._originalFetch;
    this._originalFetch = null;
    this._enabled = false;
  }

  // ── Access logs ────────────────────────────────────
  getLogs() {
    return logStore.getAll();
  }

  clearLogs() {
    logStore.clear();
  }

  subscribe(fn: (entry: LogEntry) => void) {
    return logStore.subscribe(fn);
  }
}
