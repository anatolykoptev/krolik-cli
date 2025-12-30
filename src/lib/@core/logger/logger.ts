/**
 * @module lib/@core/logger
 * @description Colored console logging with multiple output styles
 */

import chalk from 'chalk';
import type { Logger, LogLevel } from '../../../types/commands/base';

/**
 * Logger options
 */
interface LoggerOptions {
  /** Minimum log level */
  level?: LogLevel;
  /** Use colors */
  colors?: boolean;
  /** Custom write function (for testing) */
  write?: (message: string) => void;
}

/**
 * Log level priority
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const { level = 'info', colors = true, write = console.log } = options;

  const shouldLog = (msgLevel: LogLevel): boolean => {
    return LOG_LEVELS[msgLevel] >= LOG_LEVELS[level];
  };

  const format = colors
    ? {
        debug: (msg: string) => chalk.dim(msg),
        info: (msg: string) => chalk.cyan(msg),
        warn: (msg: string) => chalk.yellow(msg),
        error: (msg: string) => chalk.red(msg),
        success: (msg: string) => chalk.green(msg),
        header: (msg: string) => chalk.bold.blue(msg),
      }
    : {
        debug: (msg: string) => msg,
        info: (msg: string) => msg,
        warn: (msg: string) => `[WARN] ${msg}`,
        error: (msg: string) => `[ERROR] ${msg}`,
        success: (msg: string) => msg,
        header: (msg: string) => msg,
      };

  return {
    debug(message: string): void {
      if (shouldLog('debug')) {
        write(format.debug(message));
      }
    },

    info(message: string): void {
      if (shouldLog('info')) {
        write(format.info(message));
      }
    },

    warn(message: string): void {
      if (shouldLog('warn')) {
        write(format.warn(message));
      }
    },

    error(message: string): void {
      if (shouldLog('error')) {
        write(format.error(message));
      }
    },

    success(message: string): void {
      if (shouldLog('info')) {
        write(format.success(message));
      }
    },

    section(title: string): void {
      if (shouldLog('info')) {
        write('');
        write(format.header('═'.repeat(60)));
        write(format.header(`  ${title}`));
        write(format.header('═'.repeat(60)));
        write('');
      }
    },

    box(lines: string[], type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
      if (!shouldLog('info')) return;

      const maxLen = Math.max(...lines.map((l) => l.length));
      const border = '─'.repeat(maxLen + 2);
      const colorFn =
        type === 'success'
          ? format.success
          : type === 'warning'
            ? format.warn
            : type === 'error'
              ? format.error
              : format.info;
      write(colorFn(`┌${border}┐`));
      for (const line of lines) {
        write(colorFn(`│ ${line.padEnd(maxLen)} │`));
      }
      write(colorFn(`└${border}┘`));
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();
