import type { LogEntry, Destination, InterceptorMode } from "./types";

type Subscriber = (entry: LogEntry) => void;

const MAX_ENTRIES = 1000;

/**
 * In-memory log store with pub/sub support.
 * Used by both the interceptor core and the dashboard server.
 */
class LogStore {
  private entries: LogEntry[] = [];
  private subscribers: Set<Subscriber> = new Set();

  push(entry: LogEntry, destinations: Destination[], mode: InterceptorMode) {
    // always store in memory
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }

    // console output
    if (destinations.includes("console")) {
      this.printToConsole(entry, mode);
    }

    // notify subscribers (SSE, dashboard)
    this.subscribers.forEach((fn) => fn(entry));
  }

  getAll(): LogEntry[] {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  get length() {
    return this.entries.length;
  }

  private printToConsole(entry: LogEntry, mode: InterceptorMode) {
    const prefix = entry.valid ? "PASS" : "FAIL";
    const icon = entry.valid ? "+" : "x";
    const line = `[${icon}] ${prefix} ${entry.method} ${entry.path} (${entry.direction})`;

    if (entry.valid) {
      if (mode !== "observe") console.log(line);
    } else {
      if (mode === "strict") {
        console.error(line);
        entry.errors.forEach((e) =>
          console.error(`    ${e.path.join(".")}: ${e.message}`)
        );
      } else if (mode === "warn") {
        console.warn(line);
        entry.errors.forEach((e) =>
          console.warn(`    ${e.path.join(".")}: ${e.message}`)
        );
      } else {
        console.log(line);
      }
    }
  }
}

// Singleton
export const logStore = new LogStore();
