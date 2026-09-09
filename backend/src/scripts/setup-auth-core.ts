import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function setupAuthCoreTable() {
  try {
    logger.info('Starting Auth Core table setup...');
    await db.connect();

    // Create authorization_codes table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='authorization_codes' AND xtype='U')
      CREATE TABLE authorization_codes (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        code VARCHAR(255) UNIQUE NOT NULL,
        client_id VARCHAR(255) NOT NULL,
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        redirect_uri NVARCHAR(MAX) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        is_used BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('authorization_codes table checked/created.');

    logger.info('Auth Core setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up Auth Core table', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

setupAuthCoreTable();
