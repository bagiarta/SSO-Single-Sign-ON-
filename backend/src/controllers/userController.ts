import { Request, Response } from 'express';
import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import { createAuditLog } from './providerController';
import bcrypt from 'bcryptjs';

/**
 * Get users with search and pagination
 */
export async function getUsers(req: Request, res: Response) {
  try {
    const search = req.query['search'] as string || '';
    const status = req.query['status'] as string || '';
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;
    
    let queryStr = `
      SELECT u.id, u.nip, u.email, u.username, u.first_name, u.last_name, u.status, u.created_at, u.last_login_at,
             u.mfa_enabled, u.locked_until, u.force_password_change, u.failed_login_attempts, u.allow_dashboard_access,
             mb.name as cabang, u.regency, ml.code as loc_code, ml.name as location_name, mcc.name as cost_center_name, met.name as job_type, mp.name as position, mg.name as grade, u.join_date, met.name as emp_type, u.start_work, u.last_day, u.remarks,
             u.branch_id, u.location_id, u.department_id, u.position_id, u.grade_id, u.emp_type_id, u.cost_center_id,
             p.gender, p.timezone, p.locale,
             (SELECT STRING_AGG(r.name, ',') FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id) as roles
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN master_branches mb ON u.branch_id = mb.id
      LEFT JOIN master_locations ml ON u.location_id = ml.id
      LEFT JOIN master_cost_centers mcc ON u.cost_center_id = mcc.id
      LEFT JOIN master_positions mp ON u.position_id = mp.id
      LEFT JOIN master_grades mg ON u.grade_id = mg.id
      LEFT JOIN master_employee_types met ON u.emp_type_id = met.id
      WHERE u.deleted_at IS NULL
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      queryStr += ` AND (u.nip LIKE $${paramIndex} OR u.email LIKE $${paramIndex} OR u.username LIKE $${paramIndex} OR u.first_name LIKE $${paramIndex} OR u.last_name LIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      queryStr += ` AND u.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    queryStr += ` ORDER BY u.created_at DESC OFFSET $${paramIndex} ROWS FETCH NEXT $${paramIndex + 1} ROWS ONLY`;
    queryParams.push(offset, limit);

    const result = await query(queryStr, queryParams);
    
    // Get total count
    let countStr = 'SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL';
    const countParams: any[] = [];
    if (search) { countStr += ` AND (nip LIKE $1 OR email LIKE $1 OR username LIKE $1 OR first_name LIKE $1 OR last_name LIKE $1)`; countParams.push(`%${search}%`); }
    if (status) { countStr += search ? ` AND status = $2` : ` AND status = $1`; countParams.push(status); }
    
    const countResult = await query(countStr, countParams);

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching users', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

/**
 * Get a user by ID
 */
export async function getUserById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const userResult = await query(
      `SELECT u.id, u.nip, u.email, u.username, u.first_name, u.last_name, u.status, u.created_at, u.updated_at, u.last_login_at,
              u.mfa_enabled, u.locked_until, u.force_password_change, u.failed_login_attempts, u.allow_dashboard_access,
              mb.name as cabang, u.regency, ml.code as loc_code, ml.name as location_name, mcc.name as cost_center_name, met.name as job_type, mp.name as position, mg.name as grade, u.join_date, met.name as emp_type, u.start_work, u.last_day, u.remarks,
              u.branch_id, u.location_id, u.department_id, u.position_id, u.grade_id, u.emp_type_id, u.cost_center_id,
              p.birth_date, p.gender, p.bio, p.timezone, p.locale
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN master_branches mb ON u.branch_id = mb.id
       LEFT JOIN master_locations ml ON u.location_id = ml.id
       LEFT JOIN master_cost_centers mcc ON u.cost_center_id = mcc.id
       LEFT JOIN master_positions mp ON u.position_id = mp.id
       LEFT JOIN master_grades mg ON u.grade_id = mg.id
       LEFT JOIN master_employee_types met ON u.emp_type_id = met.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get emails
    const emailsResult = await query('SELECT id, email, is_primary, is_verified FROM user_emails WHERE user_id = $1 ORDER BY is_primary DESC', [id]);
    user.emails = emailsResult.rows;

    // Get roles
    const rolesResult = await query('SELECT r.id, r.name, r.is_system FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1', [id]);
    user.roles = rolesResult.rows;

    // Get phones
    const phonesResult = await query('SELECT id, phone_number, type, is_primary, is_verified FROM user_phones WHERE user_id = $1 ORDER BY is_primary DESC', [id]);
    user.phones = phonesResult.rows;

    // Get addresses
    const addressesResult = await query('SELECT id, address_line_1, address_line_2, city, state, postal_code, country, is_primary FROM user_addresses WHERE user_id = $1 ORDER BY is_primary DESC', [id]);
    user.addresses = addressesResult.rows;

    // Get allowed applications
    const appsResult = await query('SELECT client_app_id FROM user_allowed_applications WHERE user_id = $1', [id]);
    user.allowed_applications = appsResult.rows.map(r => r.client_app_id);

    return res.json(user);
  } catch (error: any) {
    logger.error('Error fetching user by ID', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

/**
 * Create user (Identity Management)
 */
export async function createUser(req: Request, res: Response) {
  try {
    const { 
      nip, email, username, first_name, last_name, status = 'active',
      regency, join_date, start_work, last_day, remarks,
      branch_id, location_id, department_id, position_id, grade_id, emp_type_id, cost_center_id,
      birth_date, gender, bio, timezone, locale,
      additional_emails = [], phones = [], addresses = [], roles = [],
      password, force_password_change, allow_dashboard_access = false
    } = req.body;

    if (!nip || !username || !first_name || !last_name) {
      return res.status(400).json({ error: 'Missing required fields (nip, username, first_name, last_name)' });
    }

    const safeBirthDate = birth_date === '' ? null : birth_date;
    const safeEmail = email && email.trim() !== '' ? email.trim() : null;

    let pwd_hash = 'default_unhashed';
    if (password) {
      pwd_hash = await bcrypt.hash(password, 10);
    }
    const fpc = force_password_change ? 1 : 0;
    const allowDashboard = allow_dashboard_access ? 1 : 0;

    const newUser = await transaction(async (client) => {
      // 1. Insert User
      const userRes = await client.query(
        `INSERT INTO users (nip, email, username, first_name, last_name, status, password_hash, force_password_change, allow_dashboard_access, regency, join_date, start_work, last_day, remarks, branch_id, location_id, department_id, position_id, grade_id, emp_type_id, cost_center_id)
         OUTPUT INSERTED.id
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [nip, safeEmail, username, first_name, last_name, status, pwd_hash, fpc, allowDashboard, regency, join_date, start_work, last_day, remarks, branch_id || null, location_id || null, department_id || null, position_id || null, grade_id || null, emp_type_id || null, cost_center_id || null]
      );
      const userId = userRes.rows[0].id;

      // 2. Insert Profile
      await client.query(
        `INSERT INTO user_profiles (user_id, birth_date, gender, bio, timezone, locale)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, safeBirthDate, gender, bio, timezone, locale]
      );

      // 3. Insert primary email
      if (email && email.trim() !== '') {
        await client.query(
          `INSERT INTO user_emails (user_id, email, is_primary, is_verified) VALUES ($1, $2, 1, 0)`,
          [userId, email]
        );
      }

      // 4. Insert additional emails
      for (const e of additional_emails) {
        await client.query(
          `INSERT INTO user_emails (user_id, email, is_primary, is_verified) VALUES ($1, $2, 0, 0)`,
          [userId, e.email]
        );
      }

      // 5. Insert phones
      for (let i = 0; i < phones.length; i++) {
        const p = phones[i];
        await client.query(
          `INSERT INTO user_phones (user_id, phone_number, type, is_primary, is_verified) VALUES ($1, $2, $3, $4, 0)`,
          [userId, p.phone_number, p.type, i === 0 ? 1 : 0]
        );
      }

      // 6. Insert addresses
      for (let i = 0; i < addresses.length; i++) {
        const a = addresses[i];
        await client.query(
          `INSERT INTO user_addresses (user_id, address_line_1, address_line_2, city, state, postal_code, country, is_primary) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, a.address_line_1, a.address_line_2, a.city, a.state, a.postal_code, a.country, i === 0 ? 1 : 0]
        );
      }

      // 7. Insert Roles
      if (Array.isArray(roles) && roles.length > 0) {
        for (const roleId of roles) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
            [userId, roleId]
          );
        }
      }

      // Allowed applications are now managed via GBAC (groups)

      return userId;
    });

    await createAuditLog('USER_CREATE', null, 'users', 'create', 'success', { userId: newUser, email });
    
    // --- Webhook to Pepinet ---
    if (Array.isArray(roles) && roles.length > 0) {
      try {
        const placeholders = roles.map((_, i) => `$${i + 1}`).join(',');
        const roleNamesRes = await query(`SELECT name FROM roles WHERE id IN (${placeholders})`, roles);
        const roleNames = roleNamesRes.rows.map(r => r.name);
        
        // If they are not admin, sync them
        if (!roleNames.some(n => n.toLowerCase().includes('admin'))) {
          await fetch('http://localhost:3001/api/webhook/sso-user-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              first_name,
              last_name,
              email,
              roles: roleNames
            })
          });
        }
      } catch (err: any) {
        logger.error('Error triggering Pepinet sync webhook', { error: err.message });
      }
    }

    // Fetch and return the newly created user
    req.params['id'] = newUser;
    return getUserById(req, res);
  } catch (error: any) {
    logger.error('Error creating user', { error: error.message });
    if (error.code === '23505') {
      return res.status(409).json({ error: 'NIP, Username, or Email already exists' });
    }
    return res.status(500).json({ error: 'Failed to create user' });
  }
}

/**
 * Update user
 */
export async function updateUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { 
      nip, email, first_name, last_name, status,
      regency, join_date, start_work, last_day, remarks,
      branch_id, location_id, department_id, position_id, grade_id, emp_type_id, cost_center_id,
      birth_date, gender, bio, timezone, locale, roles,
      password, force_password_change, allow_dashboard_access
    } = req.body;

    const checkResult = await query('SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const safeBirthDate = birth_date === '' ? null : birth_date;

    let pwd_hash = null;
    if (password) {
      pwd_hash = await bcrypt.hash(password, 10);
    }
    const fpcParam = force_password_change !== undefined ? (force_password_change ? 1 : 0) : null;
    const allowDashboardParam = allow_dashboard_access !== undefined ? (allow_dashboard_access ? 1 : 0) : null;

    await transaction(async (client) => {
      await client.query(
        `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), 
         status = COALESCE($3, status), password_hash = COALESCE($4, password_hash), 
         force_password_change = COALESCE($5, force_password_change),
         allow_dashboard_access = COALESCE($6, allow_dashboard_access),
         nip = COALESCE($7, nip),
         email = COALESCE($8, email),
         regency = COALESCE($9, regency),
         join_date = COALESCE($10, join_date),
         start_work = COALESCE($11, start_work),
         last_day = COALESCE($12, last_day),
         remarks = COALESCE($13, remarks),
         branch_id = COALESCE($14, branch_id),
         location_id = COALESCE($15, location_id),
         department_id = COALESCE($16, department_id),
         position_id = COALESCE($17, position_id),
         grade_id = COALESCE($18, grade_id),
         emp_type_id = COALESCE($19, emp_type_id),
         cost_center_id = COALESCE($20, cost_center_id),
         updated_at = CURRENT_TIMESTAMP WHERE id = $21`,
        [first_name, last_name, status, pwd_hash, fpcParam, allowDashboardParam, nip, email, regency, join_date, start_work, last_day, remarks, branch_id !== undefined ? (branch_id || null) : undefined, location_id !== undefined ? (location_id || null) : undefined, department_id !== undefined ? (department_id || null) : undefined, position_id !== undefined ? (position_id || null) : undefined, grade_id !== undefined ? (grade_id || null) : undefined, emp_type_id !== undefined ? (emp_type_id || null) : undefined, cost_center_id !== undefined ? (cost_center_id || null) : undefined, id]
      );

      await client.query(
        `UPDATE user_profiles SET birth_date = COALESCE($1, birth_date), gender = COALESCE($2, gender),
         bio = COALESCE($3, bio), timezone = COALESCE($4, timezone), locale = COALESCE($5, locale), updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $6`,
        [safeBirthDate, gender, bio, timezone, locale, id]
      );
      // Update Roles if provided
      if (Array.isArray(roles)) {
        await client.query('DELETE FROM user_roles WHERE user_id = $1', [id]);
        for (const roleId of roles) {
          await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [id, roleId]);
        }
      }

      // Allowed applications are now managed via GBAC (groups)
    });

    await createAuditLog('USER_UPDATE', null, 'users', 'update', 'success', { userId: id });
    
    return getUserById(req, res);
  } catch (error: any) {
    logger.error('Error updating user', { error: error.message });
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

/**
 * Soft Delete user
 */
export async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const userResult = await query('SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP, status = $1 WHERE id = $2', ['disabled', id]);
    
    await createAuditLog('USER_DELETE', null, 'users', 'soft_delete', 'success', { userId: id, email: userResult.rows[0].email });

    return res.json({ message: 'User deleted successfully', id });
  } catch (error: any) {
    logger.error('Error deleting user', { error: error.message });
    return res.status(500).json({ error: 'Failed to delete user' });
  }
}

/**
 * Toggle user status (Activate/Deactivate)
 */
export async function toggleUserStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP OUTPUT INSERTED.id, INSERTED.email, INSERTED.status WHERE id = $2 AND deleted_at IS NULL',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await createAuditLog('USER_STATUS_TOGGLE', null, 'users', 'status_toggle', 'success', { userId: id, status });

    return res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error toggling user status', { error: error.message });
    return res.status(500).json({ error: 'Failed to toggle user status' });
  }
}

/**
 * Enterprise SSO: Reset MFA
 */
export async function resetMfa(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, updated_at = CURRENT_TIMESTAMP OUTPUT INSERTED.id WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await createAuditLog('USER_MFA_RESET', null, 'users', 'reset_mfa', 'success', { userId: id });
    return res.json({ message: 'MFA has been reset successfully' });
  } catch (error: any) {
    logger.error('Error resetting MFA', { error: error.message });
    return res.status(500).json({ error: 'Failed to reset MFA' });
  }
}

/**
 * Enterprise SSO: Unlock Account
 */
export async function unlockAccount(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE users SET locked_until = NULL, failed_login_attempts = 0, updated_at = CURRENT_TIMESTAMP OUTPUT INSERTED.id WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await createAuditLog('USER_UNLOCK', null, 'users', 'unlock', 'success', { userId: id });
    return res.json({ message: 'Account has been unlocked successfully' });
  } catch (error: any) {
    logger.error('Error unlocking account', { error: error.message });
    return res.status(500).json({ error: 'Failed to unlock account' });
  }
}

/**
 * Enterprise SSO: Force Password Change
 */
export async function forcePasswordChange(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE users SET force_password_change = true, updated_at = CURRENT_TIMESTAMP OUTPUT INSERTED.id WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await createAuditLog('USER_FORCE_PWD_CHANGE', null, 'users', 'force_password_change', 'success', { userId: id });
    return res.json({ message: 'User forced to change password on next login' });
  } catch (error: any) {
    logger.error('Error forcing password change', { error: error.message });
    return res.status(500).json({ error: 'Failed to force password change' });
  }
}

/**
 * Enterprise SSO: Revoke All Sessions
 */
export async function revokeAllSessions(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await query(
      'UPDATE user_sessions SET is_active = 0, expires_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_active = 1',
      [id]
    );
    await createAuditLog('USER_REVOKE_SESSIONS', null, 'users', 'revoke_sessions', 'success', { userId: id });
    return res.json({ message: 'All active sessions for this user have been revoked' });
  } catch (error: any) {
    logger.error('Error revoking sessions', { error: error.message });
    return res.status(500).json({ error: 'Failed to revoke sessions' });
  }
}

/**
 * Get allowed client applications for a user
 */
export async function getAllowedApplications(req: Request, res: Response) {
  try {
    const { id: userId } = req.params;

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get allowed application client_app_ids based on GBAC rules
    const result = await query(
      `SELECT ca.id as client_app_id
       FROM client_applications ca
       WHERE ca.access_type = 'public'
          OR (ca.access_type = 'restricted' AND ca.id IN (
             SELECT gaa.client_app_id
             FROM group_allowed_applications gaa
             JOIN user_groups ug ON ug.group_id = gaa.group_id
             WHERE ug.user_id = $1
          ))`,
      [userId]
    );

    const allowedAppIds = result.rows.map((row: any) => row.client_app_id);
    return res.json(allowedAppIds);
  } catch (error: any) {
    logger.error('Error fetching user allowed applications', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch user allowed applications' });
  }
}

/**
 * Update allowed client applications for a user
 */
export async function updateAllowedApplications(req: Request, res: Response) {
  try {
    const { id: userId } = req.params;
    const { allowedAppIds } = req.body; // Array of application UUIDs (client_app_id)

    if (!Array.isArray(allowedAppIds)) {
      return res.status(400).json({ error: 'allowedAppIds must be an array of application IDs' });
    }

    // Check if user exists
    const userCheck = await query('SELECT id, username FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const username = userCheck.rows[0].username;

    await transaction(async (client) => {
      // 1. Delete all current associations
      await client.query('DELETE FROM user_allowed_applications WHERE user_id = $1', [userId]);

      // 2. Insert new associations
      for (const appId of allowedAppIds) {
        // Double-check if the client application exists
        const clientCheck = await client.query('SELECT id FROM client_applications WHERE id = $1 AND status = \'active\'', [appId]);
        if (clientCheck.rows.length > 0) {
          await client.query(
            'INSERT INTO user_allowed_applications (user_id, client_app_id) VALUES ($1, $2)',
            [userId, appId]
          );
        }
      }
    });

    await createAuditLog(
      'USER_ALLOWED_APPS_UPDATE',
      userId || null,
      'user_allowed_applications',
      'update',
      'success',
      { username, allowedCount: allowedAppIds.length }
    );

    return res.json({ success: true, message: 'User allowed applications updated successfully' });
  } catch (error: any) {
    logger.error('Error updating user allowed applications', { error: error.message });
    return res.status(500).json({ error: 'Failed to update user allowed applications' });
  }
}


