/**
 * Minimal logger implementation
 * Philosophy: Let stdout/stderr do their job, don't overcomplicate
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private isDev = process.env.NODE_ENV !== 'production';

  private format(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  info(message: string, meta?: any): void {
    console.log(this.format('info', message, meta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: any): void {
    console.error(this.format('error', message, meta));
  }

  debug(message: string, meta?: any): void {
    if (this.isDev) {
      console.log(this.format('debug', message, meta));
    }
  }
}

export const logger = new Logger();
