import { db, query } from '../database/connection';
import { logger } from '../utils/logger';

async function alterUsersTable() {
  try {
    logger.info('Starting to alter users table...');
    await db.connect();

    // Make email nullable
    try {
      await query(`ALTER TABLE users ALTER COLUMN email VARCHAR(255) NULL`);
      logger.info('email column is now nullable.');
    } catch (e: any) {
      logger.error('Could not alter email column (might already be nullable)', { error: e.message });
    }

    const columnsToAdd = [
      { name: 'nip', type: 'VARCHAR(50)' },
      { name: 'cabang', type: 'VARCHAR(100)' },
      { name: 'regency', type: 'VARCHAR(100)' },
      { name: 'loc_code', type: 'VARCHAR(50)' },
      { name: 'location_name', type: 'VARCHAR(150)' },
      { name: 'cost_center_name', type: 'VARCHAR(150)' },
      { name: 'job_type', type: 'VARCHAR(100)' },
      { name: 'position', type: 'VARCHAR(100)' },
      { name: 'grade', type: 'VARCHAR(50)' },
      { name: 'join_date', type: 'DATE' },
      { name: 'emp_type', type: 'VARCHAR(50)' },
      { name: 'start_work', type: 'DATE' },
      { name: 'last_day', type: 'DATE' },
      { name: 'remarks', type: 'NVARCHAR(MAX)' }
    ];

    for (const col of columnsToAdd) {
      try {
        await query(`
          IF NOT EXISTS (
            SELECT * FROM sys.columns 
            WHERE Name = N'${col.name}'
            AND Object_ID = Object_ID(N'users')
          )
          BEGIN
            ALTER TABLE users ADD ${col.name} ${col.type} NULL;
          END
        `);
        logger.info(`Column ${col.name} checked/added.`);
      } catch (e: any) {
        logger.error(`Error adding column ${col.name}`, { error: e.message });
      }
    }
    
    // Add unique constraint to NIP if not exists
    try {
        await query(`
          IF NOT EXISTS (
            SELECT * FROM sys.indexes 
            WHERE name = 'UQ_users_nip' AND object_id = OBJECT_ID('users')
          )
          BEGIN
            ALTER TABLE users ADD CONSTRAINT UQ_users_nip UNIQUE(nip);
          END
        `);
        logger.info('Unique constraint added to nip.');
    } catch (e: any) {
        logger.error('Error adding unique constraint to nip (you might need to manually handle existing duplicate nulls)', { error: e.message });
    }

    logger.info('Alter users table completed successfully.');
  } catch (error) {
    logger.error('Error altering table', { error });
  } finally {
    await db.close();
  }
}

alterUsersTable();
