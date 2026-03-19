/**
 * Redactor – recursively masks sensitive fields in objects.
 */

const MASK = "[REDACTED]";

export function redact(
  data: unknown,
  sensitiveKeys: string[]
): Record<string, unknown> {
  if (!data || typeof data !== "object") return data as Record<string, unknown>;

  const lowered = new Set(sensitiveKeys.map((k) => k.toLowerCase()));

  function walk(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj === null || typeof obj !== "object") return obj;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (lowered.has(key.toLowerCase())) {
        result[key] = MASK;
      } else if (typeof value === "object" && value !== null) {
        result[key] = walk(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return walk(data) as Record<string, unknown>;
}
