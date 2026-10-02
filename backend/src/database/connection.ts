/**
 * Database Connection Management (PostgreSQL)
 * 
 * This module handles PostgreSQL database connections using pg connection pooling
 * for optimal performance and resource management.
 */

import { Pool, PoolConfig } from 'pg';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { getSecret } from '../config/secrets';

interface DatabaseStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

export class DatabaseConnection {
  private pool!: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.createPool();
    // Handle process termination
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  private createPool() {
    const dbConfig: PoolConfig = {
      user: config.database.user,
      password: getSecret('databasePassword'),
      database: config.database.name,
      host: config.database.host,
      port: config.database.port,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false
    };

    this.pool = new Pool(dbConfig);
    
    this.pool.on('error', (err: any) => {
      logger.error('Database pool error', { error: err.message, stack: err.stack });
    });
  }

  /**
   * Initialize database connection and verify connectivity
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Test connection
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connected successfully', {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        maxConnections: config.database.maxConnections,
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to database', {
        error: error instanceof Error ? error.message : 'Unknown error',
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
      });
      throw error;
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[], rowCount: number }> {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', {
          query: text,
          duration,
        });
      }
      
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      logger.error('Database query error', {
        query: text,
        params,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async transaction<T>(callback: (client: { query: (text: string, params?: any[]) => Promise<{rows: any[], rowCount: number}> }) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const wrappedClient = {
        query: async (text: string, params: any[] = []) => {
          const result = await client.query(text, params);
          return {
            rows: result.rows,
            rowCount: result.rowCount || 0
          };
        }
      };
      
      // Pass the client to the callback so it can execute within the transaction
      const result = await callback(wrappedClient);
      
      await client.query('COMMIT');
      logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Ignore rollback errors
      }
      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database connection statistics
   */
  getStats(): DatabaseStats {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
    };
  }

  /**
   * Check if database is healthy and connected
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.pool.query('SELECT 1 as health');
      return result.rows.length > 0 && result.rows[0].health === 1;
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get detailed health information
   */
  async getHealthInfo(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    stats: DatabaseStats;
    version?: string;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      const versionResult = await this.pool.query('SELECT version() as version');
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        stats: this.getStats(),
        version: versionResult.rows[0]?.version,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        stats: this.getStats(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
      }
      this.isConnected = false;
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get the underlying pool instance
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Check if database is connected
   */
  isConnectedStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton database connection instance
export const db = new DatabaseConnection();

// Helper functions for common operations
export const query = <T = any>(text: string, params?: any[]): Promise<{ rows: T[], rowCount: number }> => {
  return db.query<T>(text, params);
};

export const transaction = <T>(callback: (client: { query: (text: string, params?: any[]) => Promise<{rows: any[], rowCount: number}> }) => Promise<T>): Promise<T> => {
  return db.transaction(callback);
};

export const getDbStats = (): DatabaseStats => {
  return db.getStats();
};

export const dbHealthCheck = (): Promise<boolean> => {
  return db.healthCheck();
};