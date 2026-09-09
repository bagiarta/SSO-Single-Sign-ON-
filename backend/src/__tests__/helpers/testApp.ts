/**
 * Test Application Builder
 *
 * Creates an isolated Express application for integration testing via
 * Supertest.  This app intentionally does NOT call initializeInfrastructure()
 * so it can be used without a live database or Redis instance.
 *
 * Usage:
 *
 *   import request from 'supertest';
 *   import { createTestApp } from '../helpers/testApp';
 *
 *   const app = createTestApp();
 *
 *   it('GET /health responds 200', async () => {
 *     await request(app).get('/health').expect(200);
 *   });
 */

import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { errorHandler } from '../../middleware/errorHandler';
import { requestLogger } from '../../middleware/requestLogger';
import { healthRouter } from '../../routes/health';
import { config } from '../../config/environment';

/**
 * Build and return a fully configured Express application suitable for use
 * in Supertest integration tests.
 */
export function createTestApp(): Application {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
      optionsSuccessStatus: 200,
    }),
  );

  // Body parsing & compression
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging (uses silent mode in tests via LOG_LEVEL=error)
  app.use(requestLogger);

  // Health check routes
  app.use('/health', healthRouter);

  // Simple status endpoint
  app.get('/api/status', (_req, res) => {
    res.json({
      message: 'Enterprise SSO Management API',
      version: '1.0.0',
      environment: config.nodeEnv,
    });
  });

  // 404 handler
  app.use('*', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
