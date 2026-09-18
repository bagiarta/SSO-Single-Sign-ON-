import { Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export async function getRegions(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, name FROM master_regions ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching regions', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch regions' });
  }
}

export async function getBranches(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, branch_code, name, region_id FROM master_branches ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching branches', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch branches' });
  }
}

export async function getLocations(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, code, name, address FROM master_locations ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching locations', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch locations' });
  }
}

export async function getDepartments(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, name FROM master_departments ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching departments', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

export async function getPositions(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, name, department_id FROM master_positions ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching positions', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch positions' });
  }
}

export async function getGrades(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, code, name FROM master_grades ORDER BY code ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching grades', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch grades' });
  }
}

export async function getEmployeeTypes(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, name FROM master_employee_types ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching employee types', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch employee types' });
  }
}

export async function getCostCenters(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, code, name FROM master_cost_centers ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching cost centers', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch cost centers' });
  }
}

const allowedTables: Record<string, string> = {
  'branches': 'master_branches',
  'locations': 'master_locations',
  'departments': 'master_departments',
  'positions': 'master_positions',
  'grades': 'master_grades',
  'employee-types': 'master_employee_types',
  'cost-centers': 'master_cost_centers',
  'regions': 'master_regions'
};

export async function createMasterRecord(req: Request, res: Response) {
  try {
    const type = req.params['type'] as string;
    const table = allowedTables[type];
    if (!table) return res.status(400).json({ error: 'Invalid master data type' });

    const data = req.body;
    const keys = Object.keys(data).filter(k => k !== 'id' && data[k] !== undefined);
    if (keys.length === 0) return res.status(400).json({ error: 'No data provided' });

    const values = keys.map(k => data[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');

    const result = await query(`INSERT INTO ${table} (${columns}) OUTPUT INSERTED.* VALUES (${placeholders})`, values);
    return res.status(201).json(result.rows[0]);
  } catch (error: any) {
    logger.error(`Error creating master record for ${req.params['type']}`, { error: error.message });
    return res.status(500).json({ error: 'Failed to create record', details: error.message });
  }
}

export async function updateMasterRecord(req: Request, res: Response) {
  try {
    const { type, id } = req.params as { type: string, id: string };
    const table = allowedTables[type];
    if (!table) return res.status(400).json({ error: 'Invalid master data type' });

    const data = req.body;
    const keys = Object.keys(data).filter(k => k !== 'id' && data[k] !== undefined);
    if (keys.length === 0) return res.status(400).json({ error: 'No data provided' });

    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map(k => data[k]);
    values.push(id);

    const result = await query(`UPDATE ${table} SET ${setClause} OUTPUT INSERTED.* WHERE id = $${values.length}`, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    
    return res.json(result.rows[0]);
  } catch (error: any) {
    logger.error(`Error updating master record for ${req.params['type']}`, { error: error.message });
    return res.status(500).json({ error: 'Failed to update record', details: error.message });
  }
}

export async function deleteMasterRecord(req: Request, res: Response) {
  try {
    const { type, id } = req.params as { type: string, id: string };
    const table = allowedTables[type];
    if (!table) return res.status(400).json({ error: 'Invalid master data type' });

    const result = await query(`DELETE FROM ${table} OUTPUT DELETED.id WHERE id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    
    return res.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    logger.error(`Error deleting master record for ${req.params['type']}`, { error: error.message });
    // Handle foreign key constraint violations
    if (error.number === 547) {
      return res.status(400).json({ error: 'Cannot delete record because it is in use' });
    }
    return res.status(500).json({ error: 'Failed to delete record', details: error.message });
  }
}
