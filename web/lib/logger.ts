export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: LogContext;
};

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (): LogLevel =>
  process.env.NEXT_PUBLIC_LOG_LEVEL === "debug" ||
  process.env.NEXT_PUBLIC_LOG_LEVEL === "info" ||
  process.env.NEXT_PUBLIC_LOG_LEVEL === "warn" ||
  process.env.NEXT_PUBLIC_LOG_LEVEL === "error"
    ? process.env.NEXT_PUBLIC_LOG_LEVEL
    : process.env.NODE_ENV === "production"
      ? "warn"
      : "debug";

const normalizeContext = (context?: LogContext): LogContext | undefined => {
  if (!context) return undefined;

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (value instanceof Error) {
        return [
          key,
          {
            name: value.name,
            message: value.message,
            stack: value.stack,
          },
        ];
      }

      return [key, value];
    }),
  );
};

const write = (entry: LogEntry) => {
  const method = entry.level === "debug" ? "log" : entry.level;

  if (typeof window === "undefined") {
    console[method](JSON.stringify(entry));
    return;
  }

  console[method](`[${entry.level}] ${entry.scope}: ${entry.message}`, entry);
};

export function createLogger(scope: string) {
  const log = (level: LogLevel, message: string, context?: LogContext) => {
    if (levelWeights[level] < levelWeights[configuredLevel()]) return;

    write({
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      context: normalizeContext(context),
    });
  };

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, context?: LogContext) => log("error", message, context),
  };
}
