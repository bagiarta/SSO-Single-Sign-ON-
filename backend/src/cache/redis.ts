/**
 * Redis Connection and Cache Management
 * 
 * This module handles Redis connections for session storage and general caching
 * with proper error handling and connection monitoring.
 */

import { createClient, RedisClientType } from 'redis';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

interface CacheStats {
  connected: boolean;
  memory: {
    used: string;
    peak: string;
  };
  keyspace: {
    keys: number;
    expires: number;
  };
  operations: {
    commandsProcessed: string;
    connections: string;
  };
}

export class RedisConnection {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private retryAttempts: number = 0;
  private readonly maxRetries: number = 5;
  private retryDelay: number = 1000; // Start with 1 second

  constructor() {
    const options: any = {
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        connectTimeout: 10000,
        reconnectStrategy: (retries: number) => {
          if (retries >= this.maxRetries) {
            logger.error('Redis max retry attempts reached, giving up');
            return false;
          }
          
          const delay = Math.min(this.retryDelay * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
          logger.warn(`Redis reconnection attempt ${retries + 1}/${this.maxRetries} in ${delay}ms`);
          return delay;
        },
      },
      database: config.redis.db,
    };

    if (config.redis.password) {
      options.password = config.redis.password;
    }

    this.client = createClient(options);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connecting');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.retryAttempts = 0;
      logger.info('Redis client ready', {
        host: config.redis.host,
        port: config.redis.port,
        database: config.redis.db,
      });
    });

    this.client.on('error', (error: Error) => {
      this.isConnected = false;
      logger.error('Redis client error', {
        error: error.message,
        stack: error.stack,
        retryAttempts: this.retryAttempts,
      });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.warn('Redis connection ended');
    });

    this.client.on('reconnecting', () => {
      this.retryAttempts++;
      logger.info('Redis client reconnecting', { attempt: this.retryAttempts });
    });

    // Handle process termination
    process.on('SIGINT', () => this.disconnect());
    process.on('SIGTERM', () => this.disconnect());
  }

  /**
   * Connect to Redis server
   */
  async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
        logger.info('Redis connection established successfully');
      }
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        host: config.redis.host,
        port: config.redis.port,
      });
      throw error;
    }
  }

  /**
   * Set a key-value pair with optional TTL
   */
  async set(key: string, value: string | object, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
      
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      logger.debug('Redis SET operation', { key, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Redis SET error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string, parseJson = true): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        return null;
      }

      if (parseJson && this.isJsonString(value)) {
        return JSON.parse(value) as T;
      }

      return value as T;
    } catch (error) {
      logger.error('Redis GET error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete one or more keys
   */
  async del(keys: string | string[]): Promise<number> {
    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      const deletedCount = await this.client.del(keysArray);
      
      logger.debug('Redis DEL operation', { keys: keysArray, deleted: deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Redis DEL error', {
        keys,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Set TTL for an existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, seconds);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE error', {
        key,
        seconds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add member to a set
   */
  async sadd(key: string, members: string | string[]): Promise<number> {
    try {
      const membersArray = Array.isArray(members) ? members : [members];
      return await this.client.sAdd(key, membersArray);
    } catch (error) {
      logger.error('Redis SADD error', {
        key,
        members,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Remove member from a set
   */
  async srem(key: string, members: string | string[]): Promise<number> {
    try {
      const membersArray = Array.isArray(members) ? members : [members];
      return await this.client.sRem(key, membersArray);
    } catch (error) {
      logger.error('Redis SREM error', {
        key,
        members,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Increment by a specific amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrBy(key, increment);
    } catch (error) {
      logger.error('Redis INCRBY error', {
        key,
        increment,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      logger.error('Redis DECR error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Flush all data from current database
   */
  async flushdb(): Promise<void> {
    try {
      await this.client.flushDb();
      logger.warn('Redis database flushed');
    } catch (error) {
      logger.error('Redis FLUSHDB error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check Redis health
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get detailed Redis information
   */
  async getHealthInfo(): Promise<{
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    stats?: CacheStats;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      await this.client.ping();
      const info = await this.client.info();
      const responseTime = Date.now() - start;

      // Parse Redis info into structured stats
      const stats = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        responseTime,
        stats,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get connection status
   */
  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying Redis client (use with caution)
   */
  getClient(): RedisClientType {
    return this.client;
  }

  /**
   * Helper method to check if string is valid JSON
   */
  private isJsonString(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse Redis INFO command output into structured data
   */
  private parseRedisInfo(info: string): CacheStats {
    const lines = info.split('\r\n');
    const stats: Record<string, string> = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      }
    }

    return {
      connected: this.isConnected,
      memory: {
        used: stats['used_memory_human'] || '0B',
        peak: stats['used_memory_peak_human'] || '0B',
      },
      keyspace: {
        keys: parseInt(stats['db0']?.split(',')[0]?.split('=')[1] || '0'),
        expires: parseInt(stats['db0']?.split(',')[1]?.split('=')[1] || '0'),
      },
      operations: {
        commandsProcessed: stats['total_commands_processed'] || '0',
        connections: stats['total_connections_received'] || '0',
      },
    };
  }
}

// Singleton Redis connection instance
export const redis = new RedisConnection();

// Helper functions for common cache operations
export const cacheSet = (key: string, value: string | object, ttlSeconds?: number): Promise<void> => {
  return redis.set(key, value, ttlSeconds);
};

export const cacheGet = <T = any>(key: string): Promise<T | null> => {
  return redis.get<T>(key);
};

export const cacheDel = (keys: string | string[]): Promise<number> => {
  return redis.del(keys);
};

export const cacheExists = (key: string): Promise<boolean> => {
  return redis.exists(key);
};

export const redisHealthCheck = (): Promise<boolean> => {
  return redis.healthCheck();
};