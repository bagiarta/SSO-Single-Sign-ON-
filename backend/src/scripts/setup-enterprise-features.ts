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
        ALTER TABLE users ADD force_password_change BIT DEFAULT 0;
      END
      
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'failed_login_attempts')
      BEGIN
        ALTER TABLE users ADD failed_login_attempts INT DEFAULT 0;
      END
      
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'locked_until')
      BEGIN
        ALTER TABLE users ADD locked_until DATETIME2 NULL;
      END
      
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'password_changed_at')
      BEGIN
        ALTER TABLE users ADD password_changed_at DATETIME2 DEFAULT GETDATE();
      END
    `);

    // 2. Create Roles Table
    logger.info('Creating roles table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles' AND xtype='U')
      BEGIN
        CREATE TABLE roles (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          name VARCHAR(100) UNIQUE NOT NULL,
          description NVARCHAR(MAX),
          is_system BIT DEFAULT 0,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE()
        );
        
        -- Insert default roles
        INSERT INTO roles (name, description, is_system) VALUES 
        ('SuperAdmin', 'System Administrator with full access', 1),
        ('AppManager', 'Application Manager', 1),
        ('User', 'Standard End User', 1);
      END
    `);

    // 3. Create User Roles Table
    logger.info('Creating user_roles table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_roles' AND xtype='U')
      CREATE TABLE user_roles (
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id UNIQUEIDENTIFIER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        granted_at DATETIME2 DEFAULT GETDATE(),
        PRIMARY KEY (user_id, role_id)
      )
    `);

    // 4. Create User Sessions Table
    logger.info('Creating user_sessions table...');
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_sessions' AND xtype='U')
      CREATE TABLE user_sessions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        device_info NVARCHAR(MAX),
        ip_address VARCHAR(45),
        is_active BIT DEFAULT 1,
        expires_at DATETIME2 NOT NULL,
        last_active_at DATETIME2 DEFAULT GETDATE(),
        created_at DATETIME2 DEFAULT GETDATE()
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
