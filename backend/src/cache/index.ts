/**
 * Cache Module Exports
 * 
 * This module provides a centralized export point for all cache-related
 * functionality including Redis connections and utilities.
 */

// Core Redis connection and utilities
export { 
  redis, 
  cacheSet, 
  cacheGet, 
  cacheDel, 
  cacheExists, 
  redisHealthCheck,
  RedisConnection 
} from './redis';

// Session storage utilities (will be implemented in later tasks)
export { sessionStore } from './session';

// Rate limiting cache utilities (will be implemented in later tasks)
export { rateLimitCache } from './rateLimit';