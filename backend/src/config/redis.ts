/**
 * Redis Configuration
 *
 * This module creates and exports the application-wide Redis client used for
 * session storage and general caching.  It wraps the redis v4 client with
 * connection-lifecycle management, exponential-backoff reconnection, and
 * structured logging so the rest of the application can import from the
 * single canonical path @/config/redis.
 *
 * Requirements: 10.4, 12.1
 */

import { createClient, RedisClientType } from 'redis';
import { config } from './environment';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// RedisClient class
// ---------------------------------------------------------------------------

export class RedisClient {
  private readonly client: RedisClientType;
  private _connected: boolean = false;
  private retryAttempts: number = 0;
  private readonly maxRetries: number = 5;
  private readonly baseRetryDelayMs: number = 1_000;

  constructor() {
    const socketOptions: Record<string, unknown> = {
      host: config.redis.host,
      port: config.redis.port,
      connectTimeout: 10_000,
      reconnectStrategy: (retries: number): number | false => {
        if (retries >= this.maxRetries) {
          logger.error('Redis max retry attempts reached; giving up');
          return false;
        }

        // Exponential back-off capped at 30 s
        const delay = Math.min(
          this.baseRetryDelayMs * Math.pow(2, retries),
          30_000,
        );
        logger.warn('Redis reconnecting', {
          attempt: retries + 1,
          maxRetries: this.maxRetries,
          delayMs: delay,
        });
        return delay;
      },
    };

    const clientOptions: Record<string, unknown> = {
      socket: socketOptions,
      database: config.redis.db,
    };

    if (config.redis.password) {
      clientOptions['password'] = config.redis.password;
    }

    this.client = createClient(clientOptions) as RedisClientType;
    this.attachEventHandlers();
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Connect to the Redis server.  Idempotent when already connected. */
  async connect(): Promise<void> {
    if (this._connected) {
      return;
    }

    try {
      await this.client.connect();
      logger.info('Redis connection established', {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
      });
    } catch (error) {
      logger.error('Failed to connect to Redis', {
        error: error instanceof Error ? error.message : String(error),
        host: config.redis.host,
        port: config.redis.port,
      });
      throw error;
    }
  }

  /** Gracefully close the Redis connection. */
  async disconnect(): Promise<void> {
    try {
      if (this._connected) {
        await this.client.quit();
        this._connected = false;
        logger.info('Redis connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis connection', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Core operations
  // -------------------------------------------------------------------------

  /**
   * Store a value under `key` with an optional TTL in seconds.
   * Objects are serialised to JSON automatically.
   */
  async set(
    key: string,
    value: string | object,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const serialised =
        typeof value === 'object' ? JSON.stringify(value) : value;

      if (ttlSeconds !== undefined) {
        await this.client.setEx(key, ttlSeconds, serialised);
      } else {
        await this.client.set(key, serialised);
      }

      logger.debug('Redis SET', { key, ttl: ttlSeconds });
    } catch (error) {
      logger.error('Redis SET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Retrieve the value stored at `key`.
   * JSON strings are parsed automatically unless `parseJson` is false.
   */
  async get<T = unknown>(
    key: string,
    parseJson = true,
  ): Promise<T | null> {
    try {
      const value = await this.client.get(key);

      if (value === null) {
        return null;
      }

      if (parseJson && this.isJson(value)) {
        return JSON.parse(value) as T;
      }

      return value as unknown as T;
    } catch (error) {
      logger.error('Redis GET error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Delete one or more keys.  Returns the number of keys removed. */
  async del(keys: string | string[]): Promise<number> {
    try {
      const keyArr = Array.isArray(keys) ? keys : [keys];
      const deleted = await this.client.del(keyArr);
      logger.debug('Redis DEL', { keys: keyArr, deleted });
      return deleted;
    } catch (error) {
      logger.error('Redis DEL error', {
        keys,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Returns true when `key` exists in the store. */
  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Set a TTL on an existing key.  Returns true when successful. */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE error', {
        key,
        seconds,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Return the remaining TTL for `key` in seconds. */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Add members to a Redis set.  Returns the number of new members. */
  async sadd(key: string, members: string | string[]): Promise<number> {
    try {
      const arr = Array.isArray(members) ? members : [members];
      return await this.client.sAdd(key, arr);
    } catch (error) {
      logger.error('Redis SADD error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Remove members from a Redis set.  Returns the number removed. */
  async srem(key: string, members: string | string[]): Promise<number> {
    try {
      const arr = Array.isArray(members) ? members : [members];
      return await this.client.sRem(key, arr);
    } catch (error) {
      logger.error('Redis SREM error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Return all members of a Redis set. */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Atomically increment the integer stored at `key` by 1. */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /** Return keys matching `pattern` (use sparingly in production). */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Health & observability
  // -------------------------------------------------------------------------

  /** Lightweight liveness check.  Returns true on a successful PING. */
  async healthCheck(): Promise<boolean> {
    try {
      return this._connected && (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Return rich health information for the /health/cache endpoint.
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
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        stats: this.parseInfo(info),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Whether the initial `connect()` call succeeded. */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Direct access to the underlying redis client.
   * Use wrapper methods wherever possible; reach for this only for
   * features not exposed here (e.g. Pub/Sub, pipeline, Lua scripts).
   */
  getClient(): RedisClientType {
    return this.client;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private attachEventHandlers(): void {
    this.client.on('connect', () => logger.info('Redis: connecting…'));

    this.client.on('ready', () => {
      this._connected = true;
      this.retryAttempts = 0;
      logger.info('Redis: ready', {
        host: config.redis.host,
        port: config.redis.port,
        db: config.redis.db,
      });
    });

    this.client.on('error', (err: Error) => {
      this._connected = false;
      logger.error('Redis client error', {
        error: err.message,
        retryAttempts: this.retryAttempts,
      });
    });

    this.client.on('end', () => {
      this._connected = false;
      logger.warn('Redis connection ended');
    });

    this.client.on('reconnecting', () => {
      this.retryAttempts += 1;
      logger.info('Redis reconnecting', { attempt: this.retryAttempts });
    });

    process.once('SIGINT', () => this.disconnect());
    process.once('SIGTERM', () => this.disconnect());
  }

  private isJson(value: string): boolean {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  /** Parse the raw `INFO` output into a structured object. */
  private parseInfo(info: string): CacheStats {
    const pairs: Record<string, string> = {};
    for (const line of info.split('\r\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const k = line.slice(0, colonIdx).trim();
        const v = line.slice(colonIdx + 1).trim();
        if (k) {
          pairs[k] = v ?? '';
        }
      }
    }

    const db0 = pairs['db0'] ?? '';
    const keysPart = db0.split(',')[0] ?? '';
    const expiresPart = db0.split(',')[1] ?? '';

    return {
      connected: this._connected,
      memory: {
        used: pairs['used_memory_human'] ?? '0B',
        peak: pairs['used_memory_peak_human'] ?? '0B',
      },
      keyspace: {
        keys: parseInt(keysPart.split('=')[1] ?? '0', 10),
        expires: parseInt(expiresPart.split('=')[1] ?? '0', 10),
      },
      operations: {
        commandsProcessed: pairs['total_commands_processed'] ?? '0',
        connections: pairs['total_connections_received'] ?? '0',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

/**
 * Application-wide Redis client.
 * Initialise by calling `redisClient.connect()` during server startup.
 */
export const redisClient = new RedisClient();

// Convenience wrappers -------------------------------------------------------

export const cacheSet = (
  key: string,
  value: string | object,
  ttlSeconds?: number,
): Promise<void> => redisClient.set(key, value, ttlSeconds);

export const cacheGet = <T = unknown>(key: string): Promise<T | null> =>
  redisClient.get<T>(key);

export const cacheDel = (keys: string | string[]): Promise<number> =>
  redisClient.del(keys);

export const cacheExists = (key: string): Promise<boolean> =>
  redisClient.exists(key);

export const redisHealthCheck = (): Promise<boolean> =>
  redisClient.healthCheck();
