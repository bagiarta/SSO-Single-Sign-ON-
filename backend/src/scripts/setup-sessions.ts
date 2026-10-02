import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function runSetup() {
  try {
    logger.info('Starting active_sessions table setup...');
    await db.connect();

    // 1. Create Active Sessions Table
    await query(`
      CREATE TABLE IF NOT EXISTS active_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        device_info VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked BOOLEAN DEFAULT false
      )
    `);
    logger.info('active_sessions table checked/created.');

    // 2. Add index on user_id for fast lookups
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_active_sessions_user_id' AND object_id = OBJECT_ID('active_sessions'))
      CREATE INDEX IX_active_sessions_user_id ON active_sessions(user_id)
    `);
    logger.info('active_sessions index checked/created.');

    // 3. Add index on token_hash for fast session validation
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_active_sessions_token_hash' AND object_id = OBJECT_ID('active_sessions'))
      CREATE INDEX IX_active_sessions_token_hash ON active_sessions(token_hash)
    `);
    logger.info('active_sessions token_hash index checked/created.');

    // 4. Add user_agent and device_info columns to audit_logs if they don't exist
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('audit_logs') AND name = 'user_agent')
      ALTER TABLE audit_logs ADD user_agent VARCHAR(500)
    `);
    logger.info('audit_logs.user_agent column checked/added.');

    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('audit_logs') AND name = 'device_info')
      ALTER TABLE audit_logs ADD device_info VARCHAR(255)
    `);
    logger.info('audit_logs.device_info column checked/added.');

    logger.info('Session & audit enhancement setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up sessions tables', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

runSetup();
