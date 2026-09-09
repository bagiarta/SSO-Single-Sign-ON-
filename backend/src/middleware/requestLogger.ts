import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    contentType: req.get('Content-Type'),
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  
  (res as any).end = function(chunk?: any, encoding?: BufferEncoding, cb?: () => void) {
    const duration = Date.now() - req.startTime;
    
    // Log request completion
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      contentLength: res.get('Content-Length'),
    });

    // Log slow requests
    if (duration > 2000) { // Log requests taking longer than 2 seconds
      logger.warn('Slow request detected', {
        requestId,
        method: req.method,
        url: req.url,
        duration,
      });
    }

    // Log security-relevant events
    if (req.url.includes('/auth') || req.url.includes('/login')) {
      logger.info('Authentication request', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    originalEnd.call(this, chunk, encoding || 'utf8', cb);
    return this;
  };

  next();
};