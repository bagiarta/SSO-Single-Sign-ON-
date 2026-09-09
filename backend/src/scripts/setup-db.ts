import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function runSetup() {
  try {
    logger.info('Starting SQL Server database setup...');
    await db.connect();

    // 1. Create Identity Providers Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='identity_providers' AND xtype='U')
      CREATE TABLE identity_providers (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'enabled',
        configuration NVARCHAR(MAX) NOT NULL,
        metadata NVARCHAR(MAX),
        last_validated_at DATETIME2,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('identity_providers table checked/created.');

    // 2. Create Audit Logs Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_logs' AND xtype='U')
      CREATE TABLE audit_logs (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        event_type VARCHAR(100) NOT NULL,
        user_id UNIQUEIDENTIFIER,
        ip_address VARCHAR(45),
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        result VARCHAR(50) NOT NULL,
        details NVARCHAR(MAX),
        timestamp DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('audit_logs table checked/created.');

    // 3. Create Users Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        nip VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        username VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        password_hash VARCHAR(255) NOT NULL,
        mfa_enabled BIT DEFAULT 0,
        mfa_secret VARCHAR(255),
        cabang VARCHAR(100),
        regency VARCHAR(100),
        loc_code VARCHAR(50),
        location_name VARCHAR(150),
        cost_center_name VARCHAR(150),
        job_type VARCHAR(100),
        position VARCHAR(100),
        grade VARCHAR(50),
        join_date DATE,
        emp_type VARCHAR(50),
        start_work DATE,
        last_day DATE,
        remarks NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        last_login_at DATETIME2,
        deleted_at DATETIME2 NULL
      )
    `);
    logger.info('users table checked/created.');

    // 4. Create User Profiles Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_profiles' AND xtype='U')
      CREATE TABLE user_profiles (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        birth_date DATE,
        gender VARCHAR(50),
        bio NVARCHAR(MAX),
        timezone VARCHAR(100),
        locale VARCHAR(50),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('user_profiles table checked/created.');

    // 5. Create User Emails Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_emails' AND xtype='U')
      CREATE TABLE user_emails (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        is_primary BIT DEFAULT 0,
        is_verified BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('user_emails table checked/created.');

    // 6. Create User Phones Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_phones' AND xtype='U')
      CREATE TABLE user_phones (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(50) NOT NULL,
        type VARCHAR(50),
        is_primary BIT DEFAULT 0,
        is_verified BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('user_phones table checked/created.');

    // 7. Create User Addresses Table
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_addresses' AND xtype='U')
      CREATE TABLE user_addresses (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        address_line_1 VARCHAR(255) NOT NULL,
        address_line_2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(50),
        country VARCHAR(100),
        is_primary BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    logger.info('user_addresses table checked/created.');

    logger.info('Database setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up database', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

runSetup();
