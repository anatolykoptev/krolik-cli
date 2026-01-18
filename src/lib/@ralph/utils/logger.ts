/**
 * @module @ralph/utils/logger
 * @description Structured logging for Ralph orchestrator
 *
 * All logs go to stderr to keep stdout clean for data output.
 * Supports structured data logging with context.
 */

/**
 * Ralph version identifier for logs
 */
export const RALPH_VERSION = '1.0.0';

export type RalphLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<RalphLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface RalphLogContext {
  taskId?: string;
  sessionId?: string;
  attempt?: number;
  phase?: 'setup' | 'execution' | 'validation' | 'cleanup';
  [key: string]: unknown;
}

export interface RalphLogger {
  debug(message: string, context?: RalphLogContext): void;
  info(message: string, context?: RalphLogContext): void;
  warn(message: string, context?: RalphLogContext): void;
  error(message: string, context?: RalphLogContext): void;
  /**
   * Log with timing information
   */
  timing(label: string, durationMs: number, context?: RalphLogContext): void;
  /**
   * Create a child logger with default context
   */
  child(defaultContext: RalphLogContext): RalphLogger;
}

interface LoggerOptions {
  /** Minimum log level (default: from RALPH_LOG_LEVEL env or "info") */
  level?: RalphLogLevel;
  /** Prefix for all log messages */
  prefix?: string;
  /** Default context added to all logs */
  defaultContext?: RalphLogContext;
}

/**
 * Format context as key=value pairs
 */
function formatContext(context?: RalphLogContext): string {
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
 * Create a Ralph logger instance
 */
export function createRalphLogger(options: LoggerOptions = {}): RalphLogger {
  const envLevel = process.env.RALPH_LOG_LEVEL as RalphLogLevel | undefined;
  const level = options.level ?? envLevel ?? 'info';
  const prefix = options.prefix ?? 'ralph';
  const defaultContext = options.defaultContext ?? {};

  const shouldLog = (msgLevel: RalphLogLevel): boolean => {
    return LOG_LEVELS[msgLevel] >= LOG_LEVELS[level];
  };

  const log = (msgLevel: RalphLogLevel, message: string, context?: RalphLogContext): void => {
    if (!shouldLog(msgLevel)) return;

    const timestamp = new Date().toISOString();
    const mergedContext = { ...defaultContext, ...context };
    const contextStr = formatContext(mergedContext);
    const levelTag = msgLevel.toUpperCase().padEnd(5);

    // Format: [timestamp] [level] [prefix] message context
    console.error(`[${timestamp}] [${levelTag}] [${prefix}]${contextStr} ${message}`);
  };

  const logger: RalphLogger = {
    debug(message: string, context?: RalphLogContext): void {
      log('debug', message, context);
    },

    info(message: string, context?: RalphLogContext): void {
      log('info', message, context);
    },

    warn(message: string, context?: RalphLogContext): void {
      log('warn', message, context);
    },

    error(message: string, context?: RalphLogContext): void {
      log('error', message, context);
    },

    timing(label: string, durationMs: number, context?: RalphLogContext): void {
      log('debug', `${label} completed`, { ...context, duration_ms: durationMs });
    },

    child(childContext: RalphLogContext): RalphLogger {
      return createRalphLogger({
        level,
        prefix,
        defaultContext: { ...defaultContext, ...childContext },
      });
    },
  };

  return logger;
}

/**
 * Default Ralph logger instance
 */
export const ralphLogger = createRalphLogger();

/**
 * Create a logger for a specific component
 */
export function createComponentLogger(component: string): RalphLogger {
  return createRalphLogger({ prefix: `ralph:${component}` });
}
