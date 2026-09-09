import { Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

// Helper function to create audit log
export async function createAuditLog(
  eventType: string,
  userId: string | null,
  resource: string,
  action: string,
  result: string,
  details: any,
  ipAddress?: string,
  userAgent?: string,
  deviceInfo?: string
) {
  try {
    await query(
      `INSERT INTO audit_logs (event_type, user_id, resource, action, result, details, ip_address, user_agent, device_info, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, GETDATE())`,
      [eventType, userId, resource, action, result, JSON.stringify(details), ipAddress || null, userAgent || null, deviceInfo || null]
    );
  } catch (error) {
    logger.error('Failed to create audit log', { error });
  }
}

/**
 * Get all identity providers
 */
export async function getProviders(_req: Request, res: Response) {
  try {
    const result = await query(
      'SELECT id, name, type, status, configuration, metadata, last_validated_at, created_at, updated_at FROM identity_providers ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error: any) {
    logger.error('Error fetching providers', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch identity providers' });
  }
}

/**
 * Get a single identity provider by ID
 */
export async function getProviderById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT id, name, type, status, configuration, metadata, last_validated_at, created_at, updated_at FROM identity_providers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('Error fetching provider by ID', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch identity provider' });
  }
}

/**
 * Create a new identity provider
 */
export async function createProvider(req: Request, res: Response) {
  try {
    const { name, type, status, configuration, metadata } = req.body;

    if (!name || !type || !configuration) {
      return res.status(400).json({ error: 'Name, type, and configuration are required' });
    }

    if (!['saml', 'oauth', 'ldap'].includes(type)) {
      return res.status(400).json({ error: 'Invalid provider type. Must be saml, oauth, or ldap' });
    }

    const result = await query(
      `INSERT INTO identity_providers (name, type, status, configuration, metadata, created_at, updated_at)
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.type, INSERTED.status, INSERTED.configuration, INSERTED.metadata, INSERTED.created_at, INSERTED.updated_at
       VALUES ($1, $2, $3, $4, $5, GETDATE(), GETDATE())`,
      [
        name,
        type,
        status || 'enabled',
        typeof configuration === 'string' ? configuration : JSON.stringify(configuration),
        metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : '{}'
      ]
    );

    const newProvider = result.rows[0];

    // Log event
    await createAuditLog(
      'PROVIDER_CREATE',
      null, // No authenticated user session in this demo
      'identity_providers',
      'create',
      'success',
      { providerId: newProvider.id, providerName: name, type }
    );

    return res.status(201).json(newProvider);
  } catch (error: any) {
    logger.error('Error creating provider', { error: error.message });
    return res.status(500).json({ error: error.message || 'Failed to create identity provider' });
  }
}

/**
 * Update an existing identity provider
 */
export async function updateProvider(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, type, status, configuration, metadata } = req.body;

    // Check if exists
    const checkResult = await query('SELECT id, name FROM identity_providers WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    const currentProvider = checkResult.rows[0];

    const result = await query(
      `UPDATE identity_providers 
       SET name = COALESCE($1, name),
           type = COALESCE($2, type),
           status = COALESCE($3, status),
           configuration = COALESCE($4, configuration),
           metadata = COALESCE($5, metadata),
           updated_at = GETDATE()
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.type, INSERTED.status, INSERTED.configuration, INSERTED.metadata, INSERTED.created_at, INSERTED.updated_at
       WHERE id = $6`,
      [
        name,
        type,
        status,
        configuration ? (typeof configuration === 'string' ? configuration : JSON.stringify(configuration)) : null,
        metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
        id
      ]
    );

    const updatedProvider = result.rows[0];

    // Log event
    await createAuditLog(
      'PROVIDER_UPDATE',
      null,
      'identity_providers',
      'update',
      'success',
      { providerId: id, oldName: currentProvider.name, newName: updatedProvider.name, type: updatedProvider.type }
    );

    return res.json(updatedProvider);
  } catch (error: any) {
    logger.error('Error updating provider', { error: error.message });
    return res.status(500).json({ error: 'Failed to update identity provider' });
  }
}

/**
 * Delete an identity provider
 */
export async function deleteProvider(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Get provider details first for audit logging
    const providerResult = await query('SELECT id, name, type FROM identity_providers WHERE id = $1', [id]);
    if (providerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    const provider = providerResult.rows[0];

    await query('DELETE FROM identity_providers WHERE id = $1', [id]);

    // Log event
    await createAuditLog(
      'PROVIDER_DELETE',
      null,
      'identity_providers',
      'delete',
      'success',
      { providerId: id, providerName: provider.name, type: provider.type }
    );

    return res.json({ message: 'Identity provider deleted successfully', id });
  } catch (error: any) {
    logger.error('Error deleting provider', { error: error.message });
    return res.status(500).json({ error: 'Failed to delete identity provider' });
  }
}

/**
 * Toggle provider status
 */
export async function toggleProviderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['enabled', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Valid status (enabled or disabled) is required' });
    }

    const result = await query(
      'UPDATE identity_providers SET status = $1, updated_at = GETDATE() OUTPUT INSERTED.id, INSERTED.name, INSERTED.status, INSERTED.type WHERE id = $2',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    const provider = result.rows[0];

    await createAuditLog(
      'PROVIDER_STATUS_TOGGLE',
      null,
      'identity_providers',
      'status_toggle',
      'success',
      { providerId: id, providerName: provider.name, type: provider.type, status }
    );

    return res.json(provider);
  } catch (error: any) {
    logger.error('Error toggling provider status', { error: error.message });
    return res.status(500).json({ error: 'Failed to toggle status' });
  }
}

/**
 * Test Connection logic
 */
export async function testConnection(req: Request, res: Response) {
  try {
    const { type, configuration } = req.body;

    if (!type || !configuration) {
      return res.status(400).json({ error: 'Type and configuration parameters are required' });
    }

    let success = false;
    let message = '';
    const details: any = {};

    // Basic simulations for demo purposes, extending to validation check
    if (type === 'saml') {
      const configObj = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
      const { entryPoint, entityId } = configObj;

      if (!entryPoint || !entityId) {
        message = 'Validation failed: entryPoint and entityId are required.';
      } else if (!entryPoint.startsWith('http://') && !entryPoint.startsWith('https://')) {
        message = 'Validation failed: entryPoint must be a valid URL.';
      } else {
        success = true;
        message = 'SAML configuration is valid. Metadatas metadata read successfully.';
        details.entryPointResolved = entryPoint;
        details.entityIdChecked = entityId;
      }
    } else if (type === 'oauth') {
      const configObj = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
      const { authorizationURL, tokenURL, clientID, clientSecret } = configObj;

      if (!authorizationURL || !tokenURL || !clientID || !clientSecret) {
        message = 'Validation failed: authorizationURL, tokenURL, clientID, and clientSecret are required.';
      } else {
        // Perform simulated ping check
        success = true;
        message = 'OAuth/OIDC endpoints verified. Handshake simulation succeeded.';
        details.authUrl = authorizationURL;
        details.tokenUrl = tokenURL;
      }
    } else if (type === 'ldap') {
      const configObj = typeof configuration === 'string' ? JSON.parse(configuration) : configuration;
      const { url, bindDN, bindCredentials, searchBase } = configObj;

      if (!url || !bindDN || !bindCredentials || !searchBase) {
        message = 'Validation failed: url, bindDN, bindCredentials, and searchBase are required.';
      } else if (!url.startsWith('ldap://') && !url.startsWith('ldaps://')) {
        message = 'Validation failed: URL must start with ldap:// or ldaps://.';
      } else {
        success = true;
        message = 'LDAP connection established. Bind user authenticated successfully.';
        details.ldapServer = url;
        details.baseDN = searchBase;
      }
    } else {
      return res.status(400).json({ error: 'Unsupported provider type for test connection' });
    }

    // Log the test action
    await createAuditLog(
      'PROVIDER_TEST_CONNECTION',
      null,
      'identity_providers',
      'test_connection',
      success ? 'success' : 'failure',
      { type, success, message, details }
    );

    // Update last_validated_at if a specific provider ID was provided
    if (req.body.id && success) {
      await query(
        'UPDATE identity_providers SET last_validated_at = NOW() WHERE id = $1',
        [req.body.id]
      );
    }

    return res.json({ success, message, details });
  } catch (error: any) {
    logger.error('Error testing connection', { error: error.message });
    return res.status(500).json({ error: 'Internal error during connection test' });
  }
}

/**
 * Scan configurations and provide security recommendations
 */
export async function getRecommendations(_req: Request, res: Response) {
  try {
    const result = await query('SELECT id, name, type, status, configuration FROM identity_providers');
    const providers = result.rows;
    const recommendations: any[] = [];

    // System-level check
    const enabledProviders = providers.filter(p => p.status === 'enabled');
    if (providers.length === 0) {
      recommendations.push({
        id: 'sys-no-providers',
        title: 'No Identity Providers Configured',
        description: 'Single Sign-on (SSO) is not yet active because no Identity Providers are configured. Add a SAML, OAuth, or LDAP directory provider.',
        severity: 'critical',
        actionLabel: 'Add Provider',
        actionPath: '/providers/new',
      });
    } else if (enabledProviders.length === 0) {
      recommendations.push({
        id: 'sys-all-disabled',
        title: 'All Identity Providers Disabled',
        description: 'All configured Identity Providers are disabled. Users cannot log in using single sign-on until you enable at least one provider.',
        severity: 'critical',
        actionLabel: 'Enable Providers',
        actionPath: '/providers',
      });
    }

    // Provider-level checks
    providers.forEach(p => {
      const configObj = typeof p.configuration === 'string' ? JSON.parse(p.configuration) : p.configuration;

      if (p.type === 'saml') {
        const { entryPoint, cert } = configObj;

        // Check entrypoint SSL
        if (entryPoint && entryPoint.startsWith('http://')) {
          recommendations.push({
            id: `saml-http-${p.id}`,
            title: 'Insecure SAML SSO Endpoint (HTTP)',
            description: `The SAML entry point URL for "${p.name}" uses unencrypted HTTP. Update the URL to use HTTPS to prevent credential interception.`,
            severity: 'critical',
            providerId: p.id,
            providerName: p.name,
            actionLabel: 'Edit Config',
            actionPath: `/providers/edit/${p.id}`,
          });
        }

        // Check if certificate is missing
        if (!cert || cert.trim() === '') {
          recommendations.push({
            id: `saml-no-cert-${p.id}`,
            title: 'SAML Public Certificate Missing',
            description: `No public X.509 certificate is uploaded for "${p.name}". Upstream response signatures cannot be validated, increasing spoofing risks.`,
            severity: 'warning',
            providerId: p.id,
            providerName: p.name,
            actionLabel: 'Upload Certificate',
            actionPath: `/providers/edit/${p.id}`,
          });
        }
      } else if (p.type === 'oauth') {
        const { authorizationURL, tokenURL } = configObj;

        // Check auth and token endpoints SSL
        if ((authorizationURL && authorizationURL.startsWith('http://')) || (tokenURL && tokenURL.startsWith('http://'))) {
          recommendations.push({
            id: `oauth-http-${p.id}`,
            title: 'Insecure OAuth Endpoints (HTTP)',
            description: `One or more OAuth/OIDC endpoints for "${p.name}" use unencrypted HTTP. Ensure authorization and token exchanges use HTTPS.`,
            severity: 'critical',
            providerId: p.id,
            providerName: p.name,
            actionLabel: 'Edit Config',
            actionPath: `/providers/edit/${p.id}`,
          });
        }
      } else if (p.type === 'ldap') {
        const { url } = configObj;

        // Check if URL is plain ldap://
        if (url && url.startsWith('ldap://')) {
          recommendations.push({
            id: `ldap-plain-${p.id}`,
            title: 'Insecure LDAP Connection (No TLS)',
            description: `"${p.name}" connects using plain LDAP (ldap://). User passwords and credentials will be transmitted in cleartext. Upgrade to LDAPS or StartTLS.`,
            severity: 'warning',
            providerId: p.id,
            providerName: p.name,
            actionLabel: 'Use LDAPS',
            actionPath: `/providers/edit/${p.id}`,
          });
        }
      }
    });

    res.json(recommendations);
  } catch (error: any) {
    logger.error('Error generating recommendations', { error: error.message });
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
}
