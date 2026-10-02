import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function runSetup() {
  try {
    logger.info('Starting Enterprise SSO Features database setup...');
    await db.connect();

    // 1. Add new columns to Users table
    logger.info('Adding enterprise columns to users table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'force_password_change')
      BEGIN
        ALTER TABLE users ADD force_password_change BOOLEAN DEFAULT false;
      END
      
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'failed_login_attempts')
      BEGIN
        ALTER TABLE users ADD failed_login_attempts INT DEFAULT 0;
      END
      
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'locked_until')
      BEGIN
        ALTER TABLE users ADD locked_until TIMESTAMP NULL;
      END
      
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'password_changed_at')
      BEGIN
        ALTER TABLE users ADD password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      END
    `);

    // 2. Create Roles Table
    logger.info('Creating roles table...');
    await query(`
      CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          is_system BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Insert default roles
        INSERT INTO roles (name, description, is_system) VALUES 
        ('SuperAdmin', 'System Administrator with full access', true),
        ('AppManager', 'Application Manager', true),
        ('User', 'Standard End User', true);
    `);

    // 3. Create User Roles Table
    logger.info('Creating user_roles table...');
    await query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id)
      )
    `);

    // 4. Create User Sessions Table
    logger.info('Creating user_sessions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        device_info TEXT,
        ip_address VARCHAR(45),
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    logger.info('Enterprise SSO database setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up enterprise features database', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

runSetup();
