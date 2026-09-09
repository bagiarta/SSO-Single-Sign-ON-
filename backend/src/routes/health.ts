/**
 * Health Check Endpoints
 * 
 * This module provides comprehensive health check endpoints for monitoring
 * database connectivity, cache status, and overall system health.
 */

import express, { Request, Response } from 'express';
import { db } from '../database/connection';
import { redis } from '../cache/redis';
import { migrationManager } from '../database/migrations';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

const router = express.Router();

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    migrations: ServiceHealth;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  details?: any;
  error: string | undefined;
}

/**
 * Basic health check endpoint
 * Returns simple status for load balancers
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbHealthy = await db.healthCheck();
    const redisHealthy = await redis.healthCheck();
    
    const overallStatus = dbHealthy && redisHealthy ? 'healthy' : 'unhealthy';
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  } catch (error) {
    logger.error('Health check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Detailed health check endpoint
 * Returns comprehensive system health information
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Check all services in parallel
    const [dbHealth, redisHealth, migrationHealth] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkCacheHealth(),
      checkMigrationHealth(),
    ]);

    // Determine overall status
    const services = {
      database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'unhealthy' as const, responseTime: 0, error: 'Check failed' },
      cache: redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'unhealthy' as const, responseTime: 0, error: 'Check failed' },
      migrations: migrationHealth.status === 'fulfilled' ? migrationHealth.value : { status: 'unhealthy' as const, responseTime: 0, error: 'Check failed' },
    };

    const healthyServices = Object.values(services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.values(services).length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      overallStatus = 'healthy';
    } else if (healthyServices > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: config.nodeEnv,
      services,
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(result);

    // Log health check result
    logger.info('Detailed health check completed', {
      status: overallStatus,
      responseTime: Date.now() - startTime,
      healthyServices,
      totalServices,
    });

  } catch (error) {
    logger.error('Detailed health check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      responseTime: Date.now() - startTime,
    });
  }
});

/**
 * Database-specific health check
 */
router.get('/database', async (_req: Request, res: Response) => {
  try {
    const health = await checkDatabaseHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'database',
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      service: 'database',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Cache-specific health check
 */
router.get('/cache', async (_req: Request, res: Response) => {
  try {
    const health = await checkCacheHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'cache',
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      service: 'cache',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Migration-specific health check
 */
router.get('/migrations', async (_req: Request, res: Response) => {
  try {
    const health = await checkMigrationHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'migrations',
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      service: 'migrations',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check critical services for readiness
    const dbHealthy = await db.healthCheck();
    const migrationHealthy = await migrationManager.checkHealth();
    
    const isReady = dbHealthy && migrationHealthy;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy,
        migrations: migrationHealthy,
      },
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Liveness probe for Kubernetes
 */
router.get('/live', (_req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  });
});

// Helper functions for service health checks

async function checkDatabaseHealth(): Promise<ServiceHealth> {
  try {
    const healthInfo = await db.getHealthInfo();
    return {
      status: healthInfo.status,
      responseTime: healthInfo.responseTime,
      details: {
        stats: healthInfo.stats,
        version: healthInfo.version,
      },
      error: healthInfo.error,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkCacheHealth(): Promise<ServiceHealth> {
  try {
    const healthInfo = await redis.getHealthInfo();
    return {
      status: healthInfo.status,
      responseTime: healthInfo.responseTime,
      details: healthInfo.stats,
      error: healthInfo.error,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkMigrationHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    const isHealthy = await migrationManager.checkHealth();
    const status = await migrationManager.getStatus();
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime: Date.now() - start,
      details: {
        current: status.current,
        completedCount: status.completed.length,
        canMigrate: status.canMigrate,
      },
      error: status.error,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { router as healthRouter };