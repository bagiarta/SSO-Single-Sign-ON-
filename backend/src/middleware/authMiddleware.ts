import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

const JWT_SECRET: string = (process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production') as string;

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware that verifies JWT token AND checks session validity in the database.
 * Attaches user info to req.user for downstream use (audit logs, etc.).
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, String(JWT_SECRET));
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check session in database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionResult = await query(
      `SELECT id, is_revoked, expires_at FROM active_sessions WHERE token_hash = $1`,
      [tokenHash]
    );

    if (sessionResult.rows.length > 0) {
      const session = sessionResult.rows[0];
      
      if (session.is_revoked) {
        return res.status(401).json({ error: 'Session has been revoked' });
      }

      if (new Date(session.expires_at) < new Date()) {
        await query(
          'UPDATE active_sessions SET is_revoked = true WHERE id = $1 AND is_revoked = false',
          [session.id]
        );
        return res.status(401).json({ error: 'Session expired' });
      }

      // Update last_active_at (fire-and-forget, don't block the request)
      query(
        'UPDATE active_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1',
        [session.id]
      ).catch(err => logger.error('Failed to update last_active_at', { error: err.message }));
    }
    // If session not found in DB, we still allow (for backward compatibility with existing tokens)

    // Attach user to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
    };

    return next();
  } catch (error: any) {
    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}
