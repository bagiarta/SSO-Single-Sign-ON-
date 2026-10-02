import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function runSetup() {
  try {
    logger.info('Starting SQL Server database setup...');
    await db.connect();

    // 1. Create Identity Providers Table
    await query(`
      CREATE TABLE IF NOT EXISTS identity_providers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'enabled',
        configuration TEXT NOT NULL,
        metadata TEXT,
        last_validated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('identity_providers table checked/created.');

    // 2. Create Audit Logs Table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type VARCHAR(100) NOT NULL,
        user_id UUID,
        ip_address VARCHAR(45),
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        result VARCHAR(50) NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('audit_logs table checked/created.');

    // 3. Create Users Table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nip VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255),
        username VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        password_hash VARCHAR(255) NOT NULL,
        mfa_enabled BOOLEAN DEFAULT false,
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
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);
    logger.info('users table checked/created.');

    // 4. Create User Profiles Table
    await query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        birth_date DATE,
        gender VARCHAR(50),
        bio TEXT,
        timezone VARCHAR(100),
        locale VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('user_profiles table checked/created.');

    // 5. Create User Emails Table
    await query(`
      CREATE TABLE IF NOT EXISTS user_emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('user_emails table checked/created.');

    // 6. Create User Phones Table
    await query(`
      CREATE TABLE IF NOT EXISTS user_phones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone_number VARCHAR(50) NOT NULL,
        type VARCHAR(50),
        is_primary BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('user_phones table checked/created.');

    // 7. Create User Addresses Table
    await query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        address_line_1 VARCHAR(255) NOT NULL,
        address_line_2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        postal_code VARCHAR(50),
        country VARCHAR(100),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
