import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function setupGBAC() {
  try {
    logger.info('Starting GBAC (Group-Based Access Control) database setup...');
    await db.connect();

    // 1. Create groups table
    logger.info('Creating groups table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='groups' AND xtype='U')
      BEGIN
        CREATE TABLE groups (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          name VARCHAR(100) UNIQUE NOT NULL,
          description NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
      END
    `);

    // 2. Create user_groups table
    logger.info('Creating user_groups table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_groups' AND xtype='U')
      CREATE TABLE user_groups (
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id UNIQUEIDENTIFIER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        joined_at DATETIME2 DEFAULT GETDATE(),
        PRIMARY KEY (user_id, group_id)
      )
    `);

    // 3. Add access_type to client_applications
    logger.info('Updating client_applications table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_applications') AND name = 'access_type')
      BEGIN
        ALTER TABLE client_applications ADD access_type VARCHAR(50) DEFAULT 'restricted';
      END
    `);
    
    // Update existing clients to be restricted by default if not set
    await query(`
      UPDATE client_applications SET access_type = 'restricted' WHERE access_type IS NULL;
    `);

    // 4. Create group_allowed_applications table
    logger.info('Creating group_allowed_applications table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='group_allowed_applications' AND xtype='U')
      CREATE TABLE group_allowed_applications (
        group_id UNIQUEIDENTIFIER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        client_app_id UNIQUEIDENTIFIER NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
        granted_at DATETIME2 DEFAULT GETDATE(),
        PRIMARY KEY (group_id, client_app_id)
      )
    `);

    logger.info('GBAC database setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up GBAC features', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

setupGBAC();
