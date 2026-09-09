/**
 * Migration Management System
 * 
 * This module provides programmatic access to database migrations
 * and migration status information.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from '../utils/logger';
import { db } from './connection';

const execAsync = promisify(exec);

export interface MigrationInfo {
  id: string;
  name: string;
  run_on: Date;
}

export interface MigrationStatus {
  current: string | null;
  pending: string[];
  completed: MigrationInfo[];
  canMigrate: boolean;
  error?: string;
}

export class MigrationManager {
  private readonly migrationPath: string;
  private readonly configPath: string;

  constructor() {
    this.migrationPath = path.join(process.cwd(), 'migrations');
    this.configPath = path.join(this.migrationPath, 'config.js');
  }

  /**
   * Run pending migrations
   */
  async up(count?: number): Promise<void> {
    try {
      const countArg = count ? `--count ${count}` : '';
      const command = `npx node-pg-migrate up ${countArg} --config-file ${this.configPath}`;
      
      logger.info('Running database migrations up', { command, count });
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });
      
      if (stdout) {
        logger.info('Migration output', { output: stdout });
      }
      
      if (stderr) {
        logger.warn('Migration warnings', { warnings: stderr });
      }
      
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Rollback migrations
   */
  async down(count?: number): Promise<void> {
    try {
      const countArg = count ? `--count ${count}` : '';
      const command = `npx node-pg-migrate down ${countArg} --config-file ${this.configPath}`;
      
      logger.warn('Rolling back database migrations', { command, count });
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });
      
      if (stdout) {
        logger.info('Rollback output', { output: stdout });
      }
      
      if (stderr) {
        logger.warn('Rollback warnings', { warnings: stderr });
      }
      
      logger.warn('Database migrations rolled back');
    } catch (error) {
      logger.error('Migration rollback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a new migration file
   */
  async create(name: string): Promise<string> {
    try {
      const command = `npx node-pg-migrate create ${name} --config-file ${this.configPath}`;
      
      logger.info('Creating new migration', { name, command });
      
      const { stdout } = await execAsync(command, {
        cwd: process.cwd(),
        env: process.env,
      });
      
      const migrationFile = stdout.trim();
      logger.info('Migration file created', { file: migrationFile });
      
      return migrationFile;
    } catch (error) {
      logger.error('Failed to create migration', {
        name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get current migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    try {
      // Check if migrations table exists
      const tableExists = await this.checkMigrationsTable();
      
      if (!tableExists) {
        return {
          current: null,
          pending: [],
          completed: [],
          canMigrate: true,
        };
      }

      // Get completed migrations
      const completed = await this.getCompletedMigrations();
      
      // Get current migration (latest completed)
      const current = completed.length > 0 ? completed[completed.length - 1]?.name ?? null : null;
      
      return {
        current,
        pending: [], // TODO: Implement pending migrations detection
        completed,
        canMigrate: true,
      };
    } catch (error) {
      logger.error('Failed to get migration status', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        current: null,
        pending: [],
        completed: [],
        canMigrate: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if the database is ready for migrations
   */
  async checkHealth(): Promise<boolean> {
    try {
      // Test basic connectivity
      const isHealthy = await db.healthCheck();
      if (!isHealthy) {
        return false;
      }

      // Check if we can create the migrations table if it doesn't exist
      await this.ensureMigrationsTable();
      
      return true;
    } catch (error) {
      logger.error('Migration health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Run migrations automatically if configured
   */
  async autoMigrate(): Promise<void> {
    const autoMigrateEnabled = process.env['AUTO_MIGRATE'] === 'true';
    
    if (!autoMigrateEnabled) {
      logger.debug('Auto-migration disabled');
      return;
    }

    try {
      logger.info('Auto-migration enabled, checking for pending migrations');
      
      const status = await this.getStatus();
      if (!status.canMigrate) {
        logger.warn('Cannot run auto-migration', { error: status.error });
        return;
      }

      await this.up();
      logger.info('Auto-migration completed successfully');
    } catch (error) {
      logger.error('Auto-migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw in auto-migration to allow app to start
    }
  }

  /**
   * Check if migrations table exists
   */
  private async checkMigrationsTable(): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pgmigrations'
        )
      `);
      
      return result.rows[0]?.exists === true;
    } catch (error) {
      logger.error('Failed to check migrations table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Ensure migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS pgmigrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          run_on TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (error) {
      logger.error('Failed to create migrations table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get completed migrations from database
   */
  private async getCompletedMigrations(): Promise<MigrationInfo[]> {
    try {
      const result = await db.query<MigrationInfo>(`
        SELECT id::text, name, run_on 
        FROM pgmigrations 
        ORDER BY run_on ASC
      `);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get completed migrations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

// Singleton migration manager instance
export const migrationManager = new MigrationManager();