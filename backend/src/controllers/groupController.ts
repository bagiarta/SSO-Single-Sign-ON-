import { Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export const getAllGroups = async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        g.id, g.name, g.description, g.created_at,
        (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as user_count,
        (
          SELECT json_agg(json_build_object('id', ca.id, 'name', ca.name))
          FROM group_allowed_applications gaa
          JOIN client_applications ca ON gaa.client_app_id = ca.id
          WHERE gaa.group_id = g.id
        ) as allowed_apps
      FROM groups g
      ORDER BY g.name ASC
    `);

    // Parse JSON string to array for allowed_apps if needed
    const formattedGroups = result.rows.map((g: any) => ({
      ...g,
      allowed_apps: typeof g.allowed_apps === 'string' ? JSON.parse(g.allowed_apps) : (g.allowed_apps || [])
    }));

    return res.json(formattedGroups);
  } catch (error) {
    logger.error('Error fetching groups', { error });
    return res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

export const getGroupById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = result.rows[0];

    // Get members
    const usersResult = await query(`
      SELECT u.id, u.username, u.email
      FROM user_groups ug
      JOIN users u ON ug.user_id = u.id
      WHERE ug.group_id = $1
    `, [id]);
    group.users = usersResult.rows;

    // Get apps
    const appsResult = await query(`
      SELECT ca.id, ca.name 
      FROM group_allowed_applications gaa
      JOIN client_applications ca ON gaa.client_app_id = ca.id
      WHERE gaa.group_id = $1
    `, [id]);
    group.allowed_apps = appsResult.rows;

    return res.json(group);
  } catch (error) {
    logger.error('Error fetching group', { error, id });
    return res.status(500).json({ error: 'Failed to fetch group' });
  }
};

export const createGroup = async (req: Request, res: Response) => {
  const { name, description, user_ids = [], client_ids = [] } = req.body;
  try {
    const result = await query(`
      INSERT INTO groups (name, description) 
      OUTPUT INSERTED.id 
      VALUES ($1, $2)
    `, [name, description]);

    const groupId = result.rows[0].id;

    // Add users
    for (const userId of user_ids) {
      await query(`INSERT INTO user_groups (group_id, user_id) VALUES ($1, $2)`, [groupId, userId]);
    }

    // Add apps
    for (const clientId of client_ids) {
      await query(`INSERT INTO group_allowed_applications (group_id, client_app_id) VALUES ($1, $2)`, [groupId, clientId]);
    }

    return res.status(201).json({ id: groupId, message: 'Group created successfully' });
  } catch (error) {
    logger.error('Error creating group', { error, name });
    return res.status(500).json({ error: 'Failed to create group' });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, user_ids, client_ids } = req.body;
  
  try {
    await query(`
      UPDATE groups 
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [name, description, id]);

    // Update users if provided
    if (user_ids) {
      await query(`DELETE FROM user_groups WHERE group_id = $1`, [id]);
      for (const userId of user_ids) {
        await query(`INSERT INTO user_groups (group_id, user_id) VALUES ($1, $2)`, [id, userId]);
      }
    }

    // Update apps if provided
    if (client_ids) {
      await query(`DELETE FROM group_allowed_applications WHERE group_id = $1`, [id]);
      for (const clientId of client_ids) {
        await query(`INSERT INTO group_allowed_applications (group_id, client_app_id) VALUES ($1, $2)`, [id, clientId]);
      }
    }

    return res.json({ message: 'Group updated successfully' });
  } catch (error) {
    logger.error('Error updating group', { error, id });
    return res.status(500).json({ error: 'Failed to update group' });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM groups WHERE id = $1`, [id]);
    return res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    logger.error('Error deleting group', { error, id });
    return res.status(500).json({ error: 'Failed to delete group' });
  }
};
