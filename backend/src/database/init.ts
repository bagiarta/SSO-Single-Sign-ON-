/**
 * Database and Cache Initialization
 * 
 * This module handles the initialization of database connections,
 * Redis cache, and runs any necessary setup procedures.
 */

import { db } from './connection';
import { redis } from '../cache/redis';
import { migrationManager } from './migrations';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

interface InitializationResult {
  success: boolean;
  database: {
    connected: boolean;
    migrated: boolean;
    error?: string;
  };
  cache: {
    connected: boolean;
    error?: string;
  };
  errors: string[];
}

/**
 * Initialize all database and cache connections
 */
export async function initializeInfrastructure(): Promise<InitializationResult> {
  const result: InitializationResult = {
    success: false,
    database: { connected: false, migrated: false },
    cache: { connected: false },
    errors: [],
  };

  logger.info('Initializing database and cache infrastructure...');

  try {
    // Initialize database connection
    await initializeDatabase(result);

    // Initialize Redis cache
    await initializeCache(result);

    // Determine overall success
    result.success = result.database.connected && result.cache.connected;

    if (result.success) {
      logger.info('Infrastructure initialization completed successfully', {
        database: result.database,
        cache: result.cache,
      });
    } else {
      logger.error('Infrastructure initialization failed', {
        database: result.database,
        cache: result.cache,
        errors: result.errors,
      });
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    result.errors.push(errorMessage);
    
    logger.error('Critical initialization error', {
      error: errorMessage,
      result,
    });

    return result;
  }
}

/**
 * Initialize database connection and run migrations
 */
async function initializeDatabase(result: InitializationResult): Promise<void> {
  try {
    logger.info('Connecting to PostgreSQL database...');
    
    // Connect to database
    await db.connect();
    result.database.connected = true;
    
    logger.info('Database connection established successfully');

    // Run migrations if configured
    try {
      await migrationManager.autoMigrate();
      result.database.migrated = true;
      logger.info('Database migrations completed');
    } catch (migrationError) {
      const errorMsg = `Migration failed: ${migrationError instanceof Error ? migrationError.message : 'Unknown error'}`;
      result.database.error = errorMsg;
      result.errors.push(errorMsg);
      
      // Log migration failure but don't fail the entire initialization
      // unless it's a critical error
      logger.warn('Database migration failed, but connection is available', {
        error: errorMsg,
      });
    }

    // Test basic database operations
    await testDatabaseOperations();

  } catch (error) {
    const errorMsg = `Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.database.error = errorMsg;
    result.errors.push(errorMsg);
    
    logger.error('Failed to initialize database', {
      error: errorMsg,
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
    });

    throw error;
  }
}

/**
 * Initialize Redis cache connection
 */
async function initializeCache(result: InitializationResult): Promise<void> {
  try {
    logger.info('Connecting to Redis cache...');
    
    // Connect to Redis
    await redis.connect();
    result.cache.connected = true;
    
    logger.info('Redis cache connection established successfully');

    // Test basic cache operations
    await testCacheOperations();

  } catch (error) {
    const errorMsg = `Cache initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.cache.error = errorMsg;
    result.errors.push(errorMsg);
    
    logger.error('Failed to initialize Redis cache', {
      error: errorMsg,
      host: config.redis.host,
      port: config.redis.port,
    });

    // Redis failure shouldn't stop the application, but log it as a warning
    logger.warn('Application will continue without cache functionality');
  }
}

/**
 * Test basic database operations
 */
async function testDatabaseOperations(): Promise<void> {
  try {
    // Test basic query
    const result = await db.query('SELECT CURRENT_TIMESTAMP as currentTime, version() as version');
    
    logger.debug('Database test query successful', {
      currentTime: result.rows[0]?.currentTime,
      version: result.rows[0]?.version?.substring(0, 50) + '...', // Truncate version string
    });

    // Test transaction
    await db.transaction(async (client) => {
      await client.query('SELECT 1');
      return true;
    });

    logger.debug('Database transaction test successful');

  } catch (error) {
    logger.error('Database operation test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Test basic cache operations
 */
async function testCacheOperations(): Promise<void> {
  try {
    const testKey = 'init:test:' + Date.now();
    const testValue = { test: true, timestamp: new Date().toISOString() };

    // Test set
    await redis.set(testKey, testValue, 60); // 60 seconds TTL

    // Test get
    const retrieved = await redis.get(testKey);
    
    if (!retrieved || retrieved.test !== true) {
      throw new Error('Cache test failed: value mismatch');
    }

    // Test delete
    await redis.del(testKey);

    logger.debug('Cache operation test successful');

  } catch (error) {
    logger.error('Cache operation test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Gracefully shutdown infrastructure connections
 */
export async function shutdownInfrastructure(): Promise<void> {
  logger.info('Shutting down infrastructure connections...');

  try {
    // Close database connections
    await db.close();
    logger.info('Database connections closed');

    // Close Redis connections
    await redis.disconnect();
    logger.info('Redis connections closed');

    logger.info('Infrastructure shutdown completed successfully');

  } catch (error) {
    logger.error('Error during infrastructure shutdown', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get current infrastructure status
 */
export function getInfrastructureStatus(): {
  database: { connected: boolean; stats?: any };
  cache: { connected: boolean };
} {
  return {
    database: {
      connected: db.isConnectedStatus(),
      stats: db.getStats(),
    },
    cache: {
      connected: redis.isConnectedStatus(),
    },
  };
}

/**
 * Health check for infrastructure components
 */
export async function checkInfrastructureHealth(): Promise<{
  healthy: boolean;
  database: boolean;
  cache: boolean;
}> {
  try {
    const [dbHealthy, cacheHealthy] = await Promise.all([
      db.healthCheck(),
      redis.healthCheck(),
    ]);

    return {
      healthy: dbHealthy && cacheHealthy,
      database: dbHealthy,
      cache: cacheHealthy,
    };
  } catch (error) {
    logger.error('Infrastructure health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      healthy: false,
      database: false,
      cache: false,
    };
  }
}