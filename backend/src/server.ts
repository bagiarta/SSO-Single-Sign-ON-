/**
 * Enterprise SSO Management Application - Backend Server
 * 
 * This is the main server entry point for the SSO management system.
 * It sets up the Express application with all necessary middleware,
 * routes, error handling, and database infrastructure.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { healthRouter } from './routes/health';
import { initializeInfrastructure, shutdownInfrastructure } from './database/init';

import { providerRouter } from './routes/providers';
import { auditRouter } from './routes/audit';
import { userRouter } from './routes/users';
import { roleRouter } from './routes/roles';
import { clientRouter } from './routes/clients';
import { authRouter } from './routes/auth';
import { sessionRouter } from './routes/sessions';
import { authenticateToken } from './middleware/authMiddleware';

const app = express();

// Trust proxy to get real IP address from X-Forwarded-For headers
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Health check routes
app.use('/health', healthRouter);

// Basic health check endpoint (legacy compatibility)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
  });
});

import { groupRouter } from './routes/groups';
import masterDataRouter from './routes/masterData';

// Register provider and audit API routes
app.use('/api/providers', authenticateToken, providerRouter);
app.use('/api/audit', authenticateToken, auditRouter);
app.use('/api/users', authenticateToken, userRouter);
app.use('/api/roles', authenticateToken, roleRouter);
app.use('/api/groups', authenticateToken, groupRouter);
app.use('/api/clients', authenticateToken, clientRouter);
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/master', authenticateToken, masterDataRouter);
app.get('/api/status', (_req, res) => {
  res.json({
    message: 'Enterprise SSO Management API',
    version: '1.0.0',
    environment: config.nodeEnv,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

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

const port = config.port;

// Initialize infrastructure and start server
async function startServer() {
  try {
    logger.info('Starting Enterprise SSO Management Application...');
    
    // Initialize database and cache connections
    const initResult = await initializeInfrastructure();
    
    if (!initResult.success) {
      logger.error('Failed to initialize infrastructure', {
        errors: initResult.errors,
      });
      
      // In development, we might want to continue despite some failures
      if (config.nodeEnv === 'production') {
        process.exit(1);
      } else {
        logger.warn('Continuing in development mode despite initialization failures');
      }
    }

    // Start HTTP server
    const server = app.listen(port, () => {
      logger.info('🚀 Server running successfully', {
        port,
        environment: config.nodeEnv,
        database: initResult.database.connected ? '✅ Connected' : '❌ Failed',
        cache: initResult.cache.connected ? '✅ Connected' : '❌ Failed',
        migrations: initResult.database.migrated ? '✅ Up to date' : '⚠️ Not run',
      });
      
      logger.info(`🔍 Health check: http://localhost:${port}/health`);
      logger.info(`📊 Detailed health: http://localhost:${port}/health/detailed`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      
      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database and cache connections
        await shutdownInfrastructure();
        
        logger.info('Process terminated gracefully');
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled rejections and exceptions
    process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
      });
      
      // Gracefully close after uncaught exception
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
// Trigger restart