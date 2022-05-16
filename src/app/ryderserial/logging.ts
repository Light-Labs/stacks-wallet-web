import { assertNever } from "./helpers";

export enum LogLevel {
    SILENT = "__SILENT__", // priority negative (will not log)
    DEBUG = "debug", // priority 0 (lowest)
    INFO = "info", // priority 1
    WARN = "warn", // priority 2
    ERROR = "error", // priority 3 (highest)
}

export interface Logger {
    (level: LogLevel, message: string | string[], extra?: Record<string, unknown>): void;
}

export function make_logger(cursor: string): Logger {
    return (level, message, extra?) => {
        if (level !== LogLevel.SILENT) {
            const cursor_message = "> " + cursor + " " + level + "\t";
            if (extra) {
                console[level](cursor_message, message, extra);
            } else {
                console[level](cursor_message, message);
            }
        }
    };
}

/**
 * order log level members by severity
 */
export function log_security_level(level: LogLevel): number {
    switch (level) {
        case LogLevel.SILENT:
            return -1;
        case LogLevel.DEBUG:
            return 20;
        case LogLevel.INFO:
            return 40;
        case LogLevel.WARN:
            return 60;
        case LogLevel.ERROR:
            return 80;
        default:
            return assertNever(level);
    }
}
