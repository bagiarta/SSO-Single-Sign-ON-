/**
 * Database Connection Management (MSSQL)
 * 
 * This module handles SQL Server database connections using mssql connection pooling
 * for optimal performance and resource management.
 */

import sql from 'mssql';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { getSecret } from '../config/secrets';

interface DatabaseStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

export class DatabaseConnection {
  private pool!: sql.ConnectionPool;
  private isConnected: boolean = false;

  constructor() {
    this.createPool();
    // Handle process termination
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  private createPool() {
    const dbConfig: sql.config = {
      user: config.database.user,
      password: getSecret('databasePassword'),
      database: config.database.name,
      server: config.database.host,
      port: config.database.port,
      pool: {
        max: config.database.maxConnections,
        min: 0,
        idleTimeoutMillis: 30000
      },
      options: {
        encrypt: config.database.ssl,
        trustServerCertificate: true, // Required for local dev or self-signed certs
      }
    };

    this.pool = new sql.ConnectionPool(dbConfig);
    
    this.pool.on('error', (err: any) => {
      logger.error('Database pool error', { error: err.message, stack: err.stack });
    });
  }

  /**
   * Initialize database connection and verify connectivity
   */
  async connect(): Promise<void> {
    try {
      await this.pool.connect();
      
      // Test connection
      await this.pool.request().query('SELECT GETDATE()');

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
   * Automatically replaces PostgreSQL syntax to MSSQL:
   * - $1, $2 to @param1, @param2
   * - ILIKE to LIKE
   * - NOW() to GETDATE()
   */
  async query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[], rowCount: number }> {
    const start = Date.now();
    
    try {
      const request = this.pool.request();
      
      // Bind parameters
      if (params && params.length > 0) {
        params.forEach((param, index) => {
          request.input(`param${index + 1}`, param);
        });
      }

      // Translate PostgreSQL syntax to MSSQL
      let mssqlQuery = text.replace(/\$(\d+)/g, '@param$1');
      mssqlQuery = mssqlQuery.replace(/\bILIKE\b/g, 'LIKE');
      mssqlQuery = mssqlQuery.replace(/\bNOW\(\)/gi, 'GETDATE()');

      const result = await request.query(mssqlQuery);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', {
          query: mssqlQuery,
          duration,
        });
      }
      
      return {
        rows: result.recordset || [],
        rowCount: result.rowsAffected[0] || 0
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
    const transaction = new sql.Transaction(this.pool);
    
    try {
      await transaction.begin();
      
      const client = {
        query: async (text: string, params: any[] = []) => {
          const request = transaction.request();
          
          if (params && params.length > 0) {
            params.forEach((param, index) => {
              request.input(`param${index + 1}`, param);
            });
          }

          let mssqlQuery = text.replace(/\$(\d+)/g, '@param$1');
          mssqlQuery = mssqlQuery.replace(/\bILIKE\b/g, 'LIKE');
          mssqlQuery = mssqlQuery.replace(/\bNOW\(\)/gi, 'GETDATE()');

          const result = await request.query(mssqlQuery);
          return {
            rows: result.recordset || [],
            rowCount: result.rowsAffected[0] || 0
          };
        }
      };
      
      // Pass the client to the callback so it can execute within the transaction
      const result = await callback(client);
      
      await transaction.commit();
      logger.debug('Transaction completed successfully');
      return result;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        // Ignore rollback errors if transaction was already closed
      }
      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get database connection statistics
   */
  getStats(): DatabaseStats {
    return {
      totalConnections: this.pool.pool ? (this.pool as any).pool.size : 0,
      idleConnections: this.pool.pool ? (this.pool as any).pool.available : 0,
      waitingClients: this.pool.pool ? (this.pool as any).pool.pending : 0,
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

      const result = await this.pool.request().query('SELECT 1 as health');
      return result.recordset.length > 0 && result.recordset[0].health === 1;
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
      const versionResult = await this.pool.request().query('SELECT @@VERSION as version');
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        stats: this.getStats(),
        version: versionResult.recordset[0]?.version,
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
        await this.pool.close();
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
  getPool(): sql.ConnectionPool {
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