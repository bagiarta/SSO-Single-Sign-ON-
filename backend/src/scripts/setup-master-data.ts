import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function runSetup() {
  try {
    logger.info('Starting Master Data database setup...');
    await db.connect();

    // 1. Create Master Tables
    logger.info('Creating master tables...');
    
    // Regions
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_regions' AND xtype='U')
      CREATE TABLE master_regions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    // Branches
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_branches' AND xtype='U')
      CREATE TABLE master_branches (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        branch_code VARCHAR(50) UNIQUE,
        name VARCHAR(100) NOT NULL,
        region_id UNIQUEIDENTIFIER REFERENCES master_regions(id) ON DELETE SET NULL
      )
    `);

    // Locations
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_locations' AND xtype='U')
      CREATE TABLE master_locations (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        code VARCHAR(50) UNIQUE,
        name VARCHAR(100) NOT NULL,
        address NVARCHAR(MAX)
      )
    `);

    // Departments
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_departments' AND xtype='U')
      CREATE TABLE master_departments (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    // Positions
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_positions' AND xtype='U')
      CREATE TABLE master_positions (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name VARCHAR(100) NOT NULL,
        department_id UNIQUEIDENTIFIER REFERENCES master_departments(id) ON DELETE SET NULL
      )
    `);

    // Grades
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_grades' AND xtype='U')
      CREATE TABLE master_grades (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        code VARCHAR(50),
        name VARCHAR(100) NOT NULL
      )
    `);

    // Employee Types
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_employee_types' AND xtype='U')
      CREATE TABLE master_employee_types (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    // Cost Centers
    await query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='master_cost_centers' AND xtype='U')
      CREATE TABLE master_cost_centers (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        code VARCHAR(50) UNIQUE,
        name VARCHAR(100) NOT NULL
      )
    `);

    // 2. Insert Dummy/Initial Master Data
    logger.info('Seeding initial master data...');
    
    // Seed Regions
    await query(`IF NOT EXISTS (SELECT * FROM master_regions) INSERT INTO master_regions (name) VALUES ('DKI Jakarta'), ('Jawa Barat'), ('Banten'), ('Jawa Tengah'), ('Jawa Timur')`);
    
    // Seed Branches
    await query(`IF NOT EXISTS (SELECT * FROM master_branches) INSERT INTO master_branches (branch_code, name) VALUES ('B-JAK1', 'Jakarta Pusat'), ('B-JAK2', 'Jakarta Selatan'), ('B-BDG', 'Bandung')`);
    
    // Seed Departments
    await query(`IF NOT EXISTS (SELECT * FROM master_departments) INSERT INTO master_departments (name) VALUES ('Information Technology'), ('Human Resources'), ('Finance'), ('Operations'), ('Sales')`);
    
    // Seed Positions
    await query(`IF NOT EXISTS (SELECT * FROM master_positions) INSERT INTO master_positions (name) VALUES ('Software Engineer'), ('System Administrator'), ('HR Manager'), ('Accountant'), ('Sales Rep')`);
    
    // Seed Grades
    await query(`IF NOT EXISTS (SELECT * FROM master_grades) INSERT INTO master_grades (code, name) VALUES ('G1', 'Staff'), ('G2', 'Supervisor'), ('G3', 'Manager'), ('G4', 'Director')`);
    
    // Seed Employee Types
    await query(`IF NOT EXISTS (SELECT * FROM master_employee_types) INSERT INTO master_employee_types (name) VALUES ('Permanent'), ('Contract'), ('Intern'), ('Freelance'), ('Vendor')`);
    
    // Seed Cost Centers
    await query(`IF NOT EXISTS (SELECT * FROM master_cost_centers) INSERT INTO master_cost_centers (code, name) VALUES ('CC-IT-01', 'IT Operations'), ('CC-HR-01', 'HR Corporate')`);

    // 3. Alter Users Table
    logger.info('Altering users table to add foreign keys...');
    
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'branch_id')
      BEGIN
        ALTER TABLE users ADD 
          branch_id UNIQUEIDENTIFIER REFERENCES master_branches(id) ON DELETE SET NULL,
          location_id UNIQUEIDENTIFIER REFERENCES master_locations(id) ON DELETE SET NULL,
          department_id UNIQUEIDENTIFIER REFERENCES master_departments(id) ON DELETE SET NULL,
          position_id UNIQUEIDENTIFIER REFERENCES master_positions(id) ON DELETE SET NULL,
          grade_id UNIQUEIDENTIFIER REFERENCES master_grades(id) ON DELETE SET NULL,
          emp_type_id UNIQUEIDENTIFIER REFERENCES master_employee_types(id) ON DELETE SET NULL,
          cost_center_id UNIQUEIDENTIFIER REFERENCES master_cost_centers(id) ON DELETE SET NULL;
      END
    `);

    logger.info('Master Data setup completed successfully.');
  } catch (error) {
    logger.error('Error setting up master data', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

runSetup();
