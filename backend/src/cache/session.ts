/**
 * Session Storage Management
 * 
 * This module provides Redis-based session storage for user sessions
 * with automatic expiration and cleanup.
 */

import { redis } from './redis';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface SessionData {
  userId: string;
  providerId?: string;
  email?: string;
  username?: string;
  roles?: string[];
  permissions?: string[];
  attributes?: Record<string, any>;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionInfo extends SessionData {
  sessionId: string;
  expiresAt: string;
  ttl: number;
}

export class SessionStore {
  private readonly sessionPrefix = 'session:';
  private readonly userSessionsPrefix = 'user:sessions:';
  private readonly defaultTTL = config.session.timeout;

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string, 
    sessionData: SessionData, 
    ttlSeconds?: number
  ): Promise<void> {
    try {
      const ttl = ttlSeconds || this.defaultTTL;
      const sessionKey = this.getSessionKey(sessionId);
      const userSessionsKey = this.getUserSessionsKey(sessionData.userId);

      const sessionInfo: SessionData = {
        ...sessionData,
        createdAt: sessionData.createdAt || new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      };

      // Store session data with TTL
      await redis.set(sessionKey, sessionInfo, ttl);

      // Add session to user's session list
      await redis.sadd(userSessionsKey, sessionId);
      await redis.expire(userSessionsKey, ttl);

      logger.debug('Session created', {
        sessionId,
        userId: sessionData.userId,
        ttl,
      });

    } catch (error) {
      logger.error('Failed to create session', {
        sessionId,
        userId: sessionData.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get session data by session ID
   */
  async getSession(sessionId: string): Promise<SessionInfo | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionData = await redis.get<SessionData>(sessionKey);

      if (!sessionData) {
        return null;
      }

      // Get TTL information
      const ttl = await redis.ttl(sessionKey);
      const expiresAt = ttl > 0 
        ? new Date(Date.now() + ttl * 1000).toISOString()
        : 'never';

      return {
        sessionId,
        ...sessionData,
        expiresAt,
        ttl,
      };

    } catch (error) {
      logger.error('Failed to get session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string, 
    updates: Partial<SessionData>, 
    extendTTL = true
  ): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const existingSession = await redis.get<SessionData>(sessionKey);

      if (!existingSession) {
        throw new Error('Session not found');
      }

      const updatedSession: SessionData = {
        ...existingSession,
        ...updates,
        lastAccessedAt: new Date().toISOString(),
      };

      // Get remaining TTL if we want to preserve it
      let ttl = this.defaultTTL;
      if (extendTTL) {
        ttl = this.defaultTTL; // Reset to default TTL
      } else {
        const remainingTTL = await redis.ttl(sessionKey);
        ttl = remainingTTL > 0 ? remainingTTL : this.defaultTTL;
      }

      await redis.set(sessionKey, updatedSession, ttl);

      logger.debug('Session updated', {
        sessionId,
        userId: updatedSession.userId,
        extendTTL,
        ttl,
      });

    } catch (error) {
      logger.error('Failed to update session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      
      // Get session data to remove from user's session list
      const sessionData = await redis.get<SessionData>(sessionKey);
      
      if (sessionData) {
        const userSessionsKey = this.getUserSessionsKey(sessionData.userId);
        await redis.srem(userSessionsKey, sessionId);
      }

      // Delete the session
      await redis.del(sessionKey);

      logger.debug('Session deleted', {
        sessionId,
        userId: sessionData?.userId,
      });

    } catch (error) {
      logger.error('Failed to delete session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await redis.smembers(userSessionsKey);

      const sessions: SessionInfo[] = [];
      
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        } else {
          // Clean up orphaned session ID
          await redis.srem(userSessionsKey, sessionId);
        }
      }

      return sessions;

    } catch (error) {
      logger.error('Failed to get user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    try {
      const userSessionsKey = this.getUserSessionsKey(userId);
      const sessionIds = await redis.smembers(userSessionsKey);

      let deletedCount = 0;
      for (const sessionId of sessionIds) {
        await this.deleteSession(sessionId);
        deletedCount++;
      }

      // Clean up the user sessions set
      await redis.del(userSessionsKey);

      logger.info('All user sessions deleted', {
        userId,
        deletedCount,
      });

      return deletedCount;

    } catch (error) {
      logger.error('Failed to delete user sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extend session TTL (refresh session)
   */
  async refreshSession(sessionId: string, ttlSeconds?: number): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const ttl = ttlSeconds || this.defaultTTL;

      const exists = await redis.exists(sessionKey);
      if (!exists) {
        throw new Error('Session not found');
      }

      // Update last accessed time and extend TTL
      await this.updateSession(sessionId, {}, true);

      logger.debug('Session refreshed', {
        sessionId,
        ttl,
      });

    } catch (error) {
      logger.error('Failed to refresh session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions (maintenance task)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      let cleanedCount = 0;
      const pattern = this.sessionPrefix + '*';
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -2) { // Key doesn't exist (expired)
          cleanedCount++;
        }
      }

      logger.info('Session cleanup completed', {
        checkedKeys: keys.length,
        cleanedCount,
      });

      return cleanedCount;

    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  }> {
    try {
      const pattern = this.sessionPrefix + '*';
      const keys = await redis.keys(pattern);

      let activeSessions = 0;
      let expiredSessions = 0;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl > 0) {
          activeSessions++;
        } else if (ttl === -2) {
          expiredSessions++;
        }
      }

      return {
        totalSessions: keys.length,
        activeSessions,
        expiredSessions,
      };

    } catch (error) {
      logger.error('Failed to get session stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
      };
    }
  }

  /**
   * Check if session exists and is valid
   */
  async isValidSession(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      return await redis.exists(sessionKey);
    } catch (error) {
      logger.error('Failed to validate session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // Helper methods
  private getSessionKey(sessionId: string): string {
    return `${this.sessionPrefix}${sessionId}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${this.userSessionsPrefix}${userId}`;
  }
}

// Singleton session store instance
export const sessionStore = new SessionStore();