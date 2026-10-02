import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function setupClientAppsTable() {
  try {
    logger.info('Starting Client Applications table setup...');
    await db.connect();

    // Create client_applications table
    await query(`
      CREATE TABLE IF NOT EXISTS client_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        client_id VARCHAR(255) UNIQUE NOT NULL,
        client_secret VARCHAR(255) NOT NULL,
        redirect_uris TEXT NOT NULL, -- Stored as JSON array
        configuration TEXT NOT NULL DEFAULT '{}', -- Client integration settings as JSON
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )

      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_applications') AND name = 'configuration')
        ALTER TABLE client_applications ADD configuration TEXT NOT NULL CONSTRAINT DF_client_applications_configuration DEFAULT '{}'
    `);
    logger.info('client_applications table checked/created.');

    // Create user_allowed_applications table
    await query(`
      CREATE TABLE IF NOT EXISTS user_allowed_applications (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_app_id UUID NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, client_app_id)
      )
    `);
    logger.info('user_allowed_applications table checked/created.');

    logger.info('Client Applications setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up Client Applications table', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

setupClientAppsTable();
