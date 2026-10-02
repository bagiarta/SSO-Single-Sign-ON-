import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function setupAuthCoreTable() {
  try {
    logger.info('Starting Auth Core table setup...');
    await db.connect();

    // Create authorization_codes table
    await query(`
      CREATE TABLE IF NOT EXISTS authorization_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(255) UNIQUE NOT NULL,
        client_id VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        redirect_uri TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
