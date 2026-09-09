/**
 * Database Module Exports
 * 
 * This module provides a centralized export point for all database-related
 * functionality including connections, migrations, and utilities.
 */

// Core database connection and utilities
export { 
  db, 
  query, 
  transaction, 
  getDbStats, 
  dbHealthCheck,
  DatabaseConnection 
} from './connection';

// Migration management
export { 
  migrationManager, 
  MigrationManager 
} from './migrations';

// Initialization and lifecycle
export { 
  initializeInfrastructure, 
  shutdownInfrastructure,
  getInfrastructureStatus,
  checkInfrastructureHealth 
} from './init';

// Type exports
export type { MigrationInfo, MigrationStatus } from './migrations';