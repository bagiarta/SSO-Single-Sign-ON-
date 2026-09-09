import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export const auditRouter = Router();

/**
 * List audit logs with pagination and filters
 */
auditRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;
    const eventType = req.query['eventType'] as string;

    let dbQuery = `
      SELECT a.id, a.event_type, a.user_id, a.ip_address, a.resource, a.action, a.result, a.details, a.timestamp,
             a.user_agent, a.device_info,
             u.username, u.email, u.first_name, u.last_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
    `;
    const params: any[] = [];

    if (eventType) {
      dbQuery += ' WHERE a.event_type = $1';
      params.push(eventType);
    }

    dbQuery += ` ORDER BY a.timestamp DESC OFFSET $${params.length + 1} ROWS FETCH NEXT $${params.length + 2} ROWS ONLY`;
    params.push(offset, limit);

    const result = await query(dbQuery, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs';
    const countParams: any[] = [];
    if (eventType) {
      countQuery += ' WHERE event_type = $1';
      countParams.push(eventType);
    }
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || '0');

    res.json({
      logs: result.rows,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching audit logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * Get summary stats for dashboard
 */
auditRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const providersCount = await query('SELECT COUNT(*) as total FROM identity_providers');
    const activeProviders = await query("SELECT COUNT(*) as total FROM identity_providers WHERE status = 'enabled'");
    const totalLogs = await query('SELECT COUNT(*) as total FROM audit_logs');
    
    // Group by type
    const providersByType = await query('SELECT type, COUNT(*) as count FROM identity_providers GROUP BY type');

    // Recent activity (last 7 days)
    const recentActivity = await query(`
      SELECT CONVERT(date, timestamp) as date, COUNT(*) as count 
      from audit_logs 
      WHERE timestamp >= DATEADD(day, -7, GETDATE())
      GROUP BY CONVERT(date, timestamp)
      ORDER BY CONVERT(date, timestamp) ASC
    `);

    res.json({
      providers: {
        total: parseInt(providersCount.rows[0]?.total || '0'),
        active: parseInt(activeProviders.rows[0]?.total || '0'),
        byType: providersByType.rows.reduce((acc: any, row: any) => {
          acc[row.type] = parseInt(row.count);
          return acc;
        }, { saml: 0, oauth: 0, ldap: 0 }),
      },
      audit: {
        total: parseInt(totalLogs.rows[0]?.total || '0'),
        recentActivity: recentActivity.rows,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});
