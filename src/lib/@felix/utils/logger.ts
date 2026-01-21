/**
 * @module @felix/utils/logger
 * @description Structured logging for Felix orchestrator
 *
 * All logs go to stderr to keep stdout clean for data output.
 * Supports structured data logging with context.
 */

/**
 * Felix version identifier for logs
 */
export const FELIX_VERSION = '1.0.0';

export type FelixLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<FelixLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface FelixLogContext {
  taskId?: string;
  sessionId?: string;
  attempt?: number;
  phase?: 'setup' | 'execution' | 'validation' | 'cleanup';
  [key: string]: unknown;
}

export interface FelixLogger {
  debug(message: string, context?: FelixLogContext): void;
  info(message: string, context?: FelixLogContext): void;
  warn(message: string, context?: FelixLogContext): void;
  error(message: string, context?: FelixLogContext): void;
  /**
   * Log with timing information
   */
  timing(label: string, durationMs: number, context?: FelixLogContext): void;
  /**
   * Create a child logger with default context
   */
  child(defaultContext: FelixLogContext): FelixLogger;
}

interface LoggerOptions {
  /** Minimum log level (default: from FELIX_LOG_LEVEL env or "info") */
  level?: FelixLogLevel;
  /** Prefix for all log messages */
  prefix?: string;
  /** Default context added to all logs */
  defaultContext?: FelixLogContext;
}

/**
 * Format context as key=value pairs
 */
function formatContext(context?: FelixLogContext): string {
  if (!context || Object.keys(context).length === 0) return '';

  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) {
      parts.push(`${key}=${JSON.stringify(value)}`);
    }
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

/**
 * Create a Felix logger instance
 */
export function createFelixLogger(options: LoggerOptions = {}): FelixLogger {
  const envLevel = process.env.FELIX_LOG_LEVEL as FelixLogLevel | undefined;
  const level = options.level ?? envLevel ?? 'info';
  const prefix = options.prefix ?? 'felix';
  const defaultContext = options.defaultContext ?? {};

  const shouldLog = (msgLevel: FelixLogLevel): boolean => {
    return LOG_LEVELS[msgLevel] >= LOG_LEVELS[level];
  };

  const log = (msgLevel: FelixLogLevel, message: string, context?: FelixLogContext): void => {
    if (!shouldLog(msgLevel)) return;

    const timestamp = new Date().toISOString();
    const mergedContext = { ...defaultContext, ...context };
    const contextStr = formatContext(mergedContext);
    const levelTag = msgLevel.toUpperCase().padEnd(5);

    // Format: [timestamp] [level] [prefix] message context
    console.error(`[${timestamp}] [${levelTag}] [${prefix}]${contextStr} ${message}`);
  };

  const logger: FelixLogger = {
    debug(message: string, context?: FelixLogContext): void {
      log('debug', message, context);
    },

    info(message: string, context?: FelixLogContext): void {
      log('info', message, context);
    },

    warn(message: string, context?: FelixLogContext): void {
      log('warn', message, context);
    },

    error(message: string, context?: FelixLogContext): void {
      log('error', message, context);
    },

    timing(label: string, durationMs: number, context?: FelixLogContext): void {
      log('debug', `${label} completed`, { ...context, duration_ms: durationMs });
    },

    child(childContext: FelixLogContext): FelixLogger {
      return createFelixLogger({
        level,
        prefix,
        defaultContext: { ...defaultContext, ...childContext },
      });
    },
  };

  return logger;
}

/**
 * Default Felix logger instance
 */
export const felixLogger = createFelixLogger();

/**
 * Create a logger for a specific component
 */
export function createComponentLogger(component: string): FelixLogger {
  return createFelixLogger({ prefix: `felix:${component}` });
}
