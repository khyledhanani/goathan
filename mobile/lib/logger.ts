export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

declare const __DEV__: boolean | undefined;

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

const devMode = (): boolean => (typeof __DEV__ === "boolean" ? __DEV__ : true);
const minimumLevel = (): LogLevel => (devMode() ? "debug" : "warn");

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

export function createLogger(scope: string) {
  const log = (level: LogLevel, message: string, context?: LogContext) => {
    if (levelWeights[level] < levelWeights[minimumLevel()]) return;

    const method = level === "debug" ? "log" : level;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      context: normalizeContext(context),
    };

    console[method](`[${entry.level}] ${entry.scope}: ${entry.message}`, entry);
  };

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, context?: LogContext) => log("error", message, context),
  };
}
