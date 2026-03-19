import type { ZodSchema } from "zod";
import type { FieldError } from "./types";

/**
 * Validate `data` against a Zod schema.
 * Returns a list of field-level errors (empty if valid).
 */
export function validate(schema: ZodSchema, data: unknown): FieldError[] {
  const result = schema.safeParse(data);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    path: issue.path as (string | number)[],
    expected: issue.code === "invalid_type" ? (issue as { expected?: string }).expected ?? "unknown" : "valid",
    received: issue.code === "invalid_type" ? (issue as { received?: string }).received ?? typeof data : typeof data,
    message: issue.message,
  }));
}
