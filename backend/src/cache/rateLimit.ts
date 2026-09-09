/**
 * Rate Limiting Cache Management
 * 
 * This module provides Redis-based rate limiting functionality
 * with sliding window and token bucket algorithms.
 */

import { redis } from './redis';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number | undefined;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export class RateLimitCache {
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: config.security.rateLimitWindowMs,
    maxRequests: config.security.rateLimitMaxRequests,
    keyPrefix: 'rate_limit:',
  };

  /**
   * Check and increment rate limit for a key using sliding window
   */
  async checkRateLimit(
    key: string, 
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitInfo> {
    const rateLimitConfig = { ...this.defaultConfig, ...customConfig };
    const rateLimitKey = `${rateLimitConfig.keyPrefix}${key}`;

    try {
      const now = Date.now();
      const windowStart = now - rateLimitConfig.windowMs;

      // Use Redis pipeline for atomic operations
      const client = redis.getClient();
      const pipeline = client.multi();

      // Remove expired entries
      pipeline.zRemRangeByScore(rateLimitKey, 0, windowStart);

      // Count current requests in window
      pipeline.zCard(rateLimitKey);

      // Add current request
      pipeline.zAdd(rateLimitKey, { score: now, value: `${now}-${Math.random()}` });

      // Set expiration for cleanup
      pipeline.expire(rateLimitKey, Math.ceil(rateLimitConfig.windowMs / 1000));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Pipeline execution failed');
      }

      const currentCount = (results[1] as any)?.reply as number || 0;
      const allowed = currentCount < rateLimitConfig.maxRequests;
      const remaining = Math.max(0, rateLimitConfig.maxRequests - currentCount - 1);
      const resetTime = now + rateLimitConfig.windowMs;

      const rateLimitInfo: RateLimitInfo = {
        allowed,
        remaining,
        resetTime,
        retryAfter: undefined,
      };

      if (!allowed) {
        rateLimitInfo.retryAfter = Math.ceil(rateLimitConfig.windowMs / 1000);
      }

      return rateLimitInfo;

    } catch (error) {
      logger.error('Failed to check rate limit', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // On error, allow the request but log it
      return {
        allowed: true,
        remaining: rateLimitConfig.maxRequests - 1,
        resetTime: Date.now() + rateLimitConfig.windowMs,
        retryAfter: undefined,
      };
    }
  }

  /**
   * Check rate limit using token bucket algorithm
   */
  async checkTokenBucket(
    key: string, 
    capacity: number, 
    refillRate: number, 
    tokensRequested = 1
  ): Promise<RateLimitInfo> {
    const bucketKey = `token_bucket:${key}`;

    try {
      const now = Date.now();
      
      // Get current bucket state
      const bucketData = await redis.get<{
        tokens: number;
        lastRefill: number;
      }>(bucketKey);

      let tokens: number;
      let lastRefill: number;

      if (bucketData) {
        tokens = bucketData.tokens;
        lastRefill = bucketData.lastRefill;
      } else {
        // Initialize new bucket
        tokens = capacity;
        lastRefill = now;
      }

      // Calculate tokens to add based on time elapsed
      const timeElapsed = now - lastRefill;
      const tokensToAdd = Math.floor((timeElapsed / 1000) * refillRate);
      tokens = Math.min(capacity, tokens + tokensToAdd);

      const allowed = tokens >= tokensRequested;
      
      if (allowed) {
        tokens -= tokensRequested;
      }

      // Update bucket state
      await redis.set(bucketKey, {
        tokens,
        lastRefill: now,
      }, 3600); // Expire after 1 hour of inactivity

      const retryAfter = allowed ? undefined : Math.ceil((tokensRequested - tokens) / refillRate);

      return {
        allowed,
        remaining: tokens,
        resetTime: 0, // Not applicable for token bucket
        retryAfter,
      };

    } catch (error) {
      logger.error('Failed to check token bucket', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // On error, allow the request
      return {
        allowed: true,
        remaining: capacity - tokensRequested,
        resetTime: 0,
        retryAfter: undefined,
      };
    }
  }

  /**
   * Get rate limit status without incrementing
   */
  async getRateLimitStatus(
    key: string, 
    customConfig?: Partial<RateLimitConfig>
  ): Promise<Omit<RateLimitInfo, 'allowed'> & { currentCount: number }> {
    const rateLimitConfig = { ...this.defaultConfig, ...customConfig };
    const rateLimitKey = `${rateLimitConfig.keyPrefix}${key}`;

    try {
      const now = Date.now();
      const windowStart = now - rateLimitConfig.windowMs;

      // Remove expired entries and count current
      await redis.getClient().zRemRangeByScore(rateLimitKey, 0, windowStart);
      const currentCount = await redis.getClient().zCard(rateLimitKey);

      const remaining = Math.max(0, rateLimitConfig.maxRequests - currentCount);
      const resetTime = now + rateLimitConfig.windowMs;

      return {
        remaining,
        resetTime,
        currentCount,
        retryAfter: undefined,
      };

    } catch (error) {
      logger.error('Failed to get rate limit status', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        remaining: rateLimitConfig.maxRequests,
        resetTime: Date.now() + rateLimitConfig.windowMs,
        currentCount: 0,
        retryAfter: undefined,
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string, keyPrefix?: string): Promise<void> {
    const prefix = keyPrefix || this.defaultConfig.keyPrefix;
    const rateLimitKey = `${prefix}${key}`;

    try {
      await redis.del(rateLimitKey);
      
      logger.debug('Rate limit reset', { key });

    } catch (error) {
      logger.error('Failed to reset rate limit', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get rate limit statistics
   */
  async getRateLimitStats(keyPattern: string): Promise<{
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
  }> {
    try {
      const pattern = `${this.defaultConfig.keyPrefix}${keyPattern}*`;
      const keys = await redis.keys(pattern);

      let activeKeys = 0;
      let totalRequests = 0;

      for (const key of keys) {
        const count = await redis.getClient().zCard(key);
        if (count > 0) {
          activeKeys++;
          totalRequests += count;
        }
      }

      return {
        totalKeys: keys.length,
        activeKeys,
        totalRequests,
      };

    } catch (error) {
      logger.error('Failed to get rate limit stats', {
        keyPattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        totalKeys: 0,
        activeKeys: 0,
        totalRequests: 0,
      };
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const pattern = `${this.defaultConfig.keyPrefix}*`;
      const keys = await redis.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -2) { // Key doesn't exist (expired)
          cleanedCount++;
        }
      }

      logger.info('Rate limit cleanup completed', {
        checkedKeys: keys.length,
        cleanedCount,
      });

      return cleanedCount;

    } catch (error) {
      logger.error('Failed to cleanup rate limit entries', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

// Singleton rate limit cache instance
export const rateLimitCache = new RateLimitCache();