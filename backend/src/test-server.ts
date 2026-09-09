/**
 * Test Server Setup
 * 
 * This script tests our Express server setup and health endpoints
 * without requiring database connections.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();

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

// Request logging
app.use(requestLogger);

// Basic health check endpoint (without database connectivity)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
    message: 'Server infrastructure test - Database connections not tested',
  });
});

// API status endpoint
app.get('/api/status', (_req, res) => {
  res.json({
    message: 'Enterprise SSO Management API',
    version: '1.0.0',
    environment: config.nodeEnv,
    infrastructure: {
      database: 'configured',
      cache: 'configured',
      migrations: 'configured',
      health: 'implemented',
    },
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

const port = 3005; // Use different port to avoid conflicts

async function testServer() {
  try {
    logger.info('🚀 Starting Enterprise SSO Management Application Test Server...');
    
    const server = app.listen(port, () => {
      logger.info('✅ Test server running successfully', {
        port,
        environment: config.nodeEnv,
        health: `http://localhost:${port}/health`,
        status: `http://localhost:${port}/api/status`,
      });
      
      // Test the endpoints
      setTimeout(async () => {
        try {
          const fetch = (await import('node-fetch')).default;
          
          logger.info('Testing health endpoint...');
          const healthResponse = await fetch(`http://localhost:${port}/health`);
          const healthData = await healthResponse.json();
          logger.info('Health endpoint response:', healthData);
          
          logger.info('Testing API status endpoint...');
          const statusResponse = await fetch(`http://localhost:${port}/api/status`);
          const statusData = await statusResponse.json();
          logger.info('API status endpoint response:', statusData);
          
          logger.info('✅ All endpoint tests passed!');
          
          // Shutdown
          server.close(() => {
            logger.info('✅ Test server shutdown complete');
            process.exit(0);
          });
          
        } catch (error) {
          logger.error('Endpoint test failed:', error);
          server.close(() => process.exit(1));
        }
      }, 2000);
    });

  } catch (error) {
    logger.error('Failed to start test server:', error);
    process.exit(1);
  }
}

testServer();