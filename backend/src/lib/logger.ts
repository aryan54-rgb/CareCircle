/**
 * Structured logger for CareCircle backend
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatMessage('DEBUG', message), ...args);
    }
  },

  info(message: string, ...args: unknown[]) {
    console.info(formatMessage('INFO', message), ...args);
  },

  log(message: string, ...args: unknown[]) {
    console.log(formatMessage('INFO', message), ...args);
  },

  warn(message: string, ...args: unknown[]) {
    console.warn(formatMessage('WARN', message), ...args);
  },

  error(message: string, ...args: unknown[]) {
    console.error(formatMessage('ERROR', message), ...args);
  },
};
