import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/environment';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });
  }),
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  }),
);

// Create transports
const transports: winston.transport[] = [];

// Console transport for development
if (config.nodeEnv === 'development') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug',
    }),
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: logFormat,
      level: config.logging.level,
    }),
  );
}

// File transports for all environments
if (config.logging.filePath) {
  // General application logs
  transports.push(
    new DailyRotateFile({
      filename: `${config.logging.filePath}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: logFormat,
      level: config.logging.level,
    }),
  );

  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: `${config.logging.filePath}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: logFormat,
      level: 'error',
    }),
  );

  // Security/audit logs
  transports.push(
    new DailyRotateFile({
      filename: `${config.logging.filePath}/security-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: '30d', // Keep security logs for 30 days
      format: logFormat,
      level: 'warn',
    }),
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create specialized loggers
export const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.label({ label: 'SECURITY' }),
  ),
  transports: [
    new DailyRotateFile({
      filename: `${config.logging.filePath}/security-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: '30d',
    }),
  ],
});

export const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.label({ label: 'AUDIT' }),
  ),
  transports: [
    new DailyRotateFile({
      filename: `${config.logging.filePath}/audit-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: `${config.audit.retentionDays}d`,
    }),
  ],
});

// Helper functions for structured logging
export const loggers = {
  // General application logging
  info: (message: string, meta?: Record<string, any>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, any>) => logger.warn(message, meta),
  error: (message: string, error?: Error | Record<string, any>) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else {
      logger.error(message, error);
    }
  },
  debug: (message: string, meta?: Record<string, any>) => logger.debug(message, meta),

  // Security-related logging
  security: {
    authAttempt: (userId: string, success: boolean, ip: string, userAgent?: string) => {
      securityLogger.info('Authentication attempt', {
        userId,
        success,
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      });
    },
    authFailure: (identifier: string, reason: string, ip: string) => {
      securityLogger.warn('Authentication failure', {
        identifier,
        reason,
        ip,
        timestamp: new Date().toISOString(),
      });
    },
    sessionCreated: (userId: string, sessionId: string, ip: string) => {
      securityLogger.info('Session created', {
        userId,
        sessionId,
        ip,
        timestamp: new Date().toISOString(),
      });
    },
    sessionTerminated: (userId: string, sessionId: string, reason: string) => {
      securityLogger.info('Session terminated', {
        userId,
        sessionId,
        reason,
        timestamp: new Date().toISOString(),
      });
    },
    suspiciousActivity: (activity: string, userId: string, ip: string, details?: Record<string, any>) => {
      securityLogger.warn('Suspicious activity detected', {
        activity,
        userId,
        ip,
        details,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Audit logging for compliance
  audit: {
    userAction: (userId: string, action: string, resource: string, details?: Record<string, any>) => {
      auditLogger.info('User action', {
        userId,
        action,
        resource,
        details,
        timestamp: new Date().toISOString(),
      });
    },
    adminAction: (adminId: string, action: string, target: string, changes?: Record<string, any>) => {
      auditLogger.info('Admin action', {
        adminId,
        action,
        target,
        changes,
        timestamp: new Date().toISOString(),
      });
    },
    configChange: (userId: string, component: string, before: any, after: any) => {
      auditLogger.info('Configuration change', {
        userId,
        component,
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        timestamp: new Date().toISOString(),
      });
    },
    dataAccess: (userId: string, resource: string, action: 'read' | 'write' | 'delete', recordCount?: number) => {
      auditLogger.info('Data access', {
        userId,
        resource,
        action,
        recordCount,
        timestamp: new Date().toISOString(),
      });
    },
  },
};