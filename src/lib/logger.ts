export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix = "", level: LogLevel = "info") {
    this.prefix = prefix;
    this.level = level;
  }

  private format(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}]` : "";
    const logEntry = {
      timestamp,
      level,
      message: `${prefix} ${message}`.trim(),
      ...meta,
    };

    switch (level) {
      case "debug":
        console.debug(JSON.stringify(logEntry));
        break;
      case "info":
        console.info(JSON.stringify(logEntry));
        break;
      case "warn":
        console.warn(JSON.stringify(logEntry));
        break;
      case "error":
        console.error(JSON.stringify(logEntry));
        break;
    }
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    this.format("debug", message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    this.format("info", message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    this.format("warn", message, meta);
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    this.format("error", message, errorMeta);
  }
}

export const createLogger = (prefix: string, level?: LogLevel): Logger => {
  return new Logger(prefix, level);
};

export const logger = new Logger("TeamTaraba", process.env.NODE_ENV === "production" ? "warn" : "debug");
