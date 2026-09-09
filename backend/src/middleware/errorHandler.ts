import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AppError extends Error {
  statusCode: number;
  code: string;
  details: Record<string, any> | undefined;
  isOperational: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public details: Record<string, any> | undefined;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, any>,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Predefined error classes
export class ValidationError extends CustomError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed', details?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Access denied', details?: Record<string, any>) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found', details?: Record<string, any>) {
    super(message, 404, 'NOT_FOUND_ERROR', details);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded', details?: Record<string, any>) {
    super(message, 429, 'RATE_LIMIT_ERROR', details);
  }
}

export class InternalServerError extends CustomError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, 'INTERNAL_ERROR', details, false);
  }
}

export class ServiceUnavailableError extends CustomError {
  constructor(message: string = 'Service temporarily unavailable', details?: Record<string, any>) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}

// Error response interface
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, any> | undefined;
    timestamp: string;
    requestId: string;
    stack: string | undefined;
  };
}

// Main error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = uuidv4();
  const timestamp = new Date().toISOString();
  
  // Add request ID to response headers for tracking
  res.setHeader('X-Request-ID', requestId);

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: Record<string, any> | undefined;

  // Handle operational errors (known errors)
  if (isAppError(error)) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else {
    // Handle unexpected errors
    logger.error('Unexpected error occurred', {
      error: error.message,
      stack: error.stack,
      requestId,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // Log the error with appropriate level
  if (statusCode >= 500) {
    logger.error('Server error', {
      code,
      message: error.message,
      requestId,
      url: req.url,
      method: req.method,
      ip: req.ip,
      stack: error.stack,
    });
  } else if (statusCode >= 400) {
    logger.warn('Client error', {
      code,
      message: error.message,
      requestId,
      url: req.url,
      method: req.method,
      ip: req.ip,
    });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      details,
      timestamp,
      requestId,
      stack: undefined,
    },
  };

  // Include stack trace in development
  if (process.env['NODE_ENV'] === 'development') {
    errorResponse.error.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Type guard to check if error is an AppError
function isAppError(error: Error | AppError): error is AppError {
  return 'statusCode' in error && 'code' in error && 'isOperational' in error;
}

// Async error handler wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global unhandled rejection and exception handlers
process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  
  // Gracefully close the server
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  
  // Gracefully close the server
  process.exit(1);
});

// Graceful shutdown handler
export const gracefulShutdown = (server: any) => {
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(() => {
      logger.info('Process terminated gracefully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};