import { Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { createAuditLog } from './providerController';
import { parseDeviceInfo } from '../utils/deviceParser';

/**
 * Get all active sessions with user info (admin view)
 */
export async function getSessions(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;
    const userId = req.query['userId'] as string || '';
    // The default view is active sessions only; expired sessions are never shown as active.
    const status = req.query['status'] as string || 'active';

    let dbQuery = `
      SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.device_info, s.client_id,
             s.created_at, s.expires_at, s.last_active_at, s.is_revoked,
             u.username, u.email, u.first_name, u.last_name,
             c.name as client_name
      FROM active_sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN client_applications c ON s.client_id = c.client_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      dbQuery += ` AND s.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (status === 'active') {
      dbQuery += ` AND s.is_revoked = false AND s.expires_at > CURRENT_TIMESTAMP`;
    } else if (status === 'revoked') {
      dbQuery += ` AND s.is_revoked = true`;
    } else if (status === 'expired') {
      dbQuery += ` AND s.is_revoked = false AND s.expires_at <= CURRENT_TIMESTAMP`;
    }

    dbQuery += ` ORDER BY s.created_at DESC OFFSET $${paramIndex} ROWS FETCH NEXT $${paramIndex + 1} ROWS ONLY`;
    params.push(offset, limit);

    const result = await query(dbQuery, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM active_sessions s WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIdx = 1;

    if (userId) {
      countQuery += ` AND s.user_id = $${countParamIdx}`;
      countParams.push(userId);
      countParamIdx++;
    }

    if (status === 'active') {
      countQuery += ` AND s.is_revoked = false AND s.expires_at > CURRENT_TIMESTAMP`;
    } else if (status === 'revoked') {
      countQuery += ` AND s.is_revoked = true`;
    } else if (status === 'expired') {
      countQuery += ` AND s.is_revoked = false AND s.expires_at <= CURRENT_TIMESTAMP`;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    res.json({
      data: result.rows,
      pagination: { total, limit, offset },
    });
  } catch (error: any) {
    logger.error('Error fetching sessions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

/**
 * Helper to trigger backchannel logout for a session
 */
export async function triggerBackchannelLogout(sessionId: string) {
  try {
    // 1. Fetch the session details to get the client_id
    const sessionRes = await query(
      'SELECT client_id FROM active_sessions WHERE id = $1',
      [sessionId]
    );

    const session = sessionRes.rows[0];
    if (!session || !session.client_id) return;

    // 2. Fetch the client's back-channel logout URL from its JSON configuration
    let client: any;
    try {
      // Keep compatibility with installations that already have the legacy
      // logout_url column, while also supporting the new JSON configuration.
      const clientRes = await query(
        'SELECT logout_url, configuration FROM client_applications WHERE client_id = $1',
        [session.client_id]
      );
      client = clientRes.rows[0];
    } catch {
      const clientRes = await query(
        'SELECT configuration FROM client_applications WHERE client_id = $1',
        [session.client_id]
      );
      client = clientRes.rows[0];
    }
    if (!client) return;

    let configuration: any = {};
    try {
      configuration = typeof client.configuration === 'string'
        ? JSON.parse(client.configuration)
        : (client.configuration || {});
    } catch {
      configuration = {};
    }

    const logoutUrl = client.logout_url || configuration.backchannelLogoutUri;
    if (!logoutUrl) return;

    logger.info(`[SLO] Triggering backchannel logout for session ${sessionId} to ${logoutUrl}`);
    
    // 3. Send the logout request
    const response = await fetch(logoutUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Preserve the original callback contract used by existing clients.
      body: JSON.stringify({ sid: sessionId })
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn('Backchannel logout failed', { sessionId, status: response.status, error: errText });
    } else {
      logger.info('Backchannel logout triggered successfully', { sessionId, client_id: session.client_id });
    }
  } catch (err: any) {
    logger.error('Failed to trigger backchannel logout', { sessionId, error: err.message });
  }
}

/**
 * Revoke (force close) a specific session
 */
export async function revokeSession(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Trigger backchannel logout BEFORE setting is_revoked = true so we can query client details
    await triggerBackchannelLogout(id as string);

    const result = await query(
      'UPDATE active_sessions SET is_revoked = true WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Audit log
    const userAgent = req.headers['user-agent'] || '';
    await createAuditLog(
      'SESSION_REVOKE',
      req.user?.id || null,
      'active_sessions',
      'revoke_session',
      'success',
      { session_id: id, message: `Session ${id} force-closed by admin` },
      req.ip || '',
      userAgent,
      parseDeviceInfo(userAgent)
    );

    logger.info('Session revoked', { sessionId: id, revokedBy: req.user?.username });
    return res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error: any) {
    logger.error('Error revoking session', { error: error.message });
    return res.status(500).json({ error: 'Failed to revoke session' });
  }
}

/**
 * Revoke all sessions of a specific user
 */
export async function revokeAllUserSessions(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    // Get active sessions of this user before revoking
    const activeSessionsRes = await query(
      'SELECT id FROM active_sessions WHERE user_id = $1 AND is_revoked = false',
      [userId]
    );

    // Trigger backchannel logout for all active sessions
    for (const session of activeSessionsRes.rows) {
      await triggerBackchannelLogout(session.id);
    }

    const result = await query(
      'UPDATE active_sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false',
      [userId]
    );

    // Audit log
    const userAgent = req.headers['user-agent'] || '';
    await createAuditLog(
      'SESSION_REVOKE_ALL',
      req.user?.id || null,
      'active_sessions',
      'revoke_all_user_sessions',
      'success',
      { target_user_id: userId, sessions_revoked: result.rowCount, message: `All sessions for user ${userId} force-closed` },
      req.ip || '',
      userAgent,
      parseDeviceInfo(userAgent)
    );

    logger.info('All user sessions revoked', { userId, revokedBy: req.user?.username, count: result.rowCount });
    return res.json({ success: true, message: `${result.rowCount} session(s) revoked` });
  } catch (error: any) {
    logger.error('Error revoking user sessions', { error: error.message });
    return res.status(500).json({ error: 'Failed to revoke user sessions' });
  }
}

/**
 * Client-initiated logout: called by client app backend when user logs out.
 * Marks the SSO active_session as revoked without sending back a backchannel logout
 * (since the user is already logging out from the client).
 */
export async function clientLogout(req: Request, res: Response) {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    await query(
      'UPDATE active_sessions SET is_revoked = true WHERE id = $1 AND is_revoked = false',
      [session_id]
    );

    logger.info('Client-initiated session logout', { session_id });
    return res.json({ success: true, message: 'Session revoked' });
  } catch (error: any) {
    logger.error('Error in client logout', { error: error.message });
    return res.status(500).json({ error: 'Failed to revoke session' });
  }
}
