import { db, transaction } from '../database/connection';
import { logger } from '../utils/logger';

async function dropLegacyColumns() {
  try {
    logger.info('Starting legacy columns cleanup...');
    await db.connect();

    await transaction(async (client) => {
      logger.info('Dropping redundant columns from users table...');
      await client.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS cabang, loc_code, location_name, cost_center_name, job_type, position, grade, emp_type
      `);
    });

    logger.info('Legacy columns dropped successfully.');
  } catch (error) {
    logger.error('Error dropping legacy columns', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

dropLegacyColumns();
