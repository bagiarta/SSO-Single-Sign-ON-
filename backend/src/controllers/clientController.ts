import { Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { createAuditLog } from './providerController';
import crypto from 'crypto';

function generateClientId(): string {
  // Typical OAuth client_id is a random string or UUID
  return crypto.randomUUID();
}

function generateClientSecret(): string {
  // Secure random string (url safe)
  return crypto.randomBytes(32).toString('base64url');
}

// Keep existing installations compatible when the client configuration column
// has not yet been added by the setup script.
let configurationColumnReady: Promise<void> | null = null;
function ensureConfigurationColumn(): Promise<void> {
  if (!configurationColumnReady) {
    configurationColumnReady = query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='client_applications' AND column_name='configuration') THEN
          ALTER TABLE client_applications ADD COLUMN configuration TEXT NOT NULL DEFAULT '{}';
        END IF;
      END
      $$;
    `).then(() => undefined).catch(error => {
      configurationColumnReady = null;
      throw error;
    });
  }
  return configurationColumnReady;
}

/**
 * Get all client applications
 */
export async function getClients(_req: Request, res: Response) {
  try {
    await ensureConfigurationColumn();
    const result = await query(
      'SELECT id, name, description, client_id, redirect_uris, configuration, access_type, status, created_at, updated_at FROM client_applications ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching clients', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch client applications' });
  }
}

/**
 * Get single client application by ID
 */
export async function getClientById(req: Request, res: Response) {
  try {
    await ensureConfigurationColumn();
    const { id } = req.params;
    const result = await query(
      'SELECT id, name, description, client_id, redirect_uris, configuration, access_type, status, created_at, updated_at FROM client_applications WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client application not found' });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error fetching client by ID', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch client application' });
  }
}

/**
 * Create a new client application
 */
export async function createClient(req: Request, res: Response) {
  try {
    await ensureConfigurationColumn();
    const { name, description, redirect_uris, status, configuration, access_type } = req.body;

    if (!name || !redirect_uris) {
      return res.status(400).json({ error: 'Name and redirect_uris are required' });
    }

    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const urisStr = Array.isArray(redirect_uris) ? JSON.stringify(redirect_uris) : redirect_uris;

    const result = await query(
      `INSERT INTO client_applications (name, description, client_id, client_secret, redirect_uris, configuration, access_type, status, created_at, updated_at)
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.client_id, INSERTED.client_secret, INSERTED.redirect_uris, INSERTED.configuration, INSERTED.access_type, INSERTED.status, INSERTED.created_at
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        name,
        description || '',
        clientId,
        clientSecret,
        urisStr,
        JSON.stringify(configuration || {}),
        access_type || 'restricted',
        status || 'active'
      ]
    );

    const newClient = result.rows[0];

    await createAuditLog(
      'CLIENT_CREATE',
      null,
      'client_applications',
      'create',
      'success',
      { clientId: newClient.client_id, name: newClient.name }
    );

    // Only return the secret on creation so it can be copied by admin once
    return res.status(201).json(newClient);
  } catch (error: any) {
    logger.error('Error creating client', { error: error.message });
    return res.status(500).json({ error: 'Failed to create client application' });
  }
}

/**
 * Update client application
 */
export async function updateClient(req: Request, res: Response) {
  try {
    await ensureConfigurationColumn();
    const { id } = req.params;
    const { name, description, redirect_uris, status, configuration, access_type } = req.body;

    const checkResult = await query('SELECT id, name FROM client_applications WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client application not found' });
    }

    const urisStr = redirect_uris ? (Array.isArray(redirect_uris) ? JSON.stringify(redirect_uris) : redirect_uris) : null;

    const result = await query(
      `UPDATE client_applications 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           redirect_uris = COALESCE($3, redirect_uris),
           configuration = COALESCE($4, configuration),
           access_type = COALESCE($5, access_type),
           status = COALESCE($6, status),
           updated_at = CURRENT_TIMESTAMP
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.client_id, INSERTED.redirect_uris, INSERTED.configuration, INSERTED.access_type, INSERTED.status, INSERTED.updated_at
       WHERE id = $7`,
      [name, description, urisStr, configuration ? JSON.stringify(configuration) : null, access_type, status, id]
    );

    const updatedClient = result.rows[0];

    await createAuditLog(
      'CLIENT_UPDATE',
      null,
      'client_applications',
      'update',
      'success',
      { clientId: updatedClient.client_id, name: updatedClient.name }
    );

    return res.json(updatedClient);
  } catch (error: any) {
    logger.error('Error updating client', { error: error.message });
    return res.status(500).json({ error: 'Failed to update client application' });
  }
}

/**
 * Regenerate Client Secret
 */
export async function regenerateClientSecret(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const checkResult = await query('SELECT id, client_id, name FROM client_applications WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client application not found' });
    }

    const newSecret = generateClientSecret();

    const result = await query(
      `UPDATE client_applications 
       SET client_secret = $1, updated_at = CURRENT_TIMESTAMP
       OUTPUT INSERTED.id, INSERTED.client_id, INSERTED.client_secret, INSERTED.name
       WHERE id = $2`,
      [newSecret, id]
    );

    const client = result.rows[0];

    await createAuditLog(
      'CLIENT_REGENERATE_SECRET',
      null,
      'client_applications',
      'regenerate_secret',
      'success',
      { clientId: client.client_id, name: client.name }
    );

    return res.json({
      message: 'Client secret regenerated successfully. Store it safely, it will not be displayed again.',
      client_id: client.client_id,
      client_secret: client.client_secret
    });
  } catch (error: any) {
    logger.error('Error regenerating secret', { error: error.message });
    return res.status(500).json({ error: 'Failed to regenerate client secret' });
  }
}

/**
 * Delete a client application
 */
export async function deleteClient(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const checkResult = await query('SELECT id, client_id, name FROM client_applications WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client application not found' });
    }

    const client = checkResult.rows[0];

    await query('DELETE FROM client_applications WHERE id = $1', [id]);

    await createAuditLog(
      'CLIENT_DELETE',
      null,
      'client_applications',
      'delete',
      'success',
      { clientId: client.client_id, name: client.name }
    );

    return res.json({ message: 'Client application deleted successfully', id });
  } catch (error: any) {
    logger.error('Error deleting client', { error: error.message });
    return res.status(500).json({ error: 'Failed to delete client application' });
  }
}
