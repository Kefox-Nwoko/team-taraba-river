const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
export class Logger {
    level;
    prefix;
    constructor(prefix = "", level = "info") {
        this.prefix = prefix;
        this.level = level;
    }
    format(level, message, meta) {
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
    debug(message, meta) {
        this.format("debug", message, meta);
    }
    info(message, meta) {
        this.format("info", message, meta);
    }
    warn(message, meta) {
        this.format("warn", message, meta);
    }
    error(message, error, meta) {
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
export const createLogger = (prefix, level) => {
    return new Logger(prefix, level);
};
export const logger = new Logger("TeamTaraba", process.env.NODE_ENV === "production" ? "warn" : "debug");
