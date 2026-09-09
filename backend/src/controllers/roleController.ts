import { Request, Response } from 'express';
import { query, transaction } from '../database/connection';
import { logger } from '../utils/logger';
import { createAuditLog } from './providerController';

/**
 * Get all roles
 */
export async function getRoles(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, name, description, is_system, created_at FROM roles ORDER BY name ASC');
    res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching roles', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

/**
 * Assign roles to user
 */
export async function assignUserRoles(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { roleIds } = req.body; // Array of role IDs

    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ error: 'roleIds must be an array' });
    }

    const checkUser = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await transaction(async (client) => {
      // Delete existing roles
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      
      // Insert new roles
      for (const roleId of roleIds) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
          [userId, roleId]
        );
      }
    });

    await createAuditLog('USER_ROLES_UPDATE', null, 'users', 'update_roles', 'success', { userId, roleIds });

    return res.json({ message: 'User roles updated successfully' });
  } catch (error: any) {
    logger.error('Error assigning roles', { error: error.message });
    return res.status(500).json({ error: 'Failed to assign roles' });
  }
}

/**
 * Create a new custom role
 */
export async function createRole(req: Request, res: Response) {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const result = await query(
      'INSERT INTO roles (name, description, is_system) OUTPUT INSERTED.* VALUES ($1, $2, 0)',
      [name, description]
    );

    await createAuditLog('ROLE_CREATE', null, 'roles', 'create', 'success', { roleId: result.rows[0].id, name });

    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error creating role', { error: error.message });
    if (error.code === '23505' || error.message.includes('Violation of UNIQUE KEY constraint')) {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    return res.status(500).json({ error: 'Failed to create role' });
  }
}

/**
 * Delete a custom role
 */
export async function deleteRole(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const checkResult = await query('SELECT is_system, name FROM roles WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (checkResult.rows[0].is_system) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    await query('DELETE FROM roles WHERE id = $1', [id]);
    
    await createAuditLog('ROLE_DELETE', null, 'roles', 'delete', 'success', { roleId: id, name: checkResult.rows[0].name });

    return res.json({ message: 'Role deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting role', { error: error.message });
    return res.status(500).json({ error: 'Failed to delete role' });
  }
}
