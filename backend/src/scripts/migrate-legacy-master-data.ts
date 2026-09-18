import { db, transaction } from '../database/connection';
import { logger } from '../utils/logger';

async function migrateLegacyData() {
  try {
    logger.info('Starting legacy master data migration...');
    await db.connect();

    await transaction(async (client) => {
      // 1. Migrate Branches (from cabang)
      logger.info('Migrating branches...');
      const branchesRes = await client.query('SELECT DISTINCT cabang FROM users WHERE cabang IS NOT NULL AND cabang != \'\'');
      for (const row of branchesRes.rows) {
        const name = row.cabang;
        let masterBranchRes = await client.query('SELECT id FROM master_branches WHERE name = $1', [name]);
        if (masterBranchRes.rows.length === 0) {
          const code = 'BR-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          masterBranchRes = await client.query('INSERT INTO master_branches (branch_code, name) OUTPUT INSERTED.id VALUES ($1, $2)', [code, name]);
        }
        const branchId = masterBranchRes.rows[0].id;
        await client.query('UPDATE users SET branch_id = $1 WHERE cabang = $2', [branchId, name]);
      }

      // 2. Migrate Locations (from loc_code / location_name)
      logger.info('Migrating locations...');
      const locsRes = await client.query('SELECT DISTINCT loc_code, location_name FROM users WHERE location_name IS NOT NULL AND location_name != \'\'');
      for (const row of locsRes.rows) {
        let code = row.loc_code || null;
        const name = row.location_name;
        let masterLocRes = await client.query('SELECT id FROM master_locations WHERE name = $1', [name]);
        if (masterLocRes.rows.length === 0) {
          if (!code) code = 'LOC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          masterLocRes = await client.query('INSERT INTO master_locations (code, name) OUTPUT INSERTED.id VALUES ($1, $2)', [code, name]);
        }
        const locId = masterLocRes.rows[0].id;
        await client.query('UPDATE users SET location_id = $1 WHERE location_name = $2', [locId, name]);
      }

      // 3. Migrate Positions (from position)
      // Note: We don't have department mapping yet, so department_id will be null
      logger.info('Migrating positions...');
      const posRes = await client.query('SELECT DISTINCT position FROM users WHERE position IS NOT NULL AND position != \'\'');
      for (const row of posRes.rows) {
        const name = row.position;
        let masterPosRes = await client.query('SELECT id FROM master_positions WHERE name = $1', [name]);
        if (masterPosRes.rows.length === 0) {
          masterPosRes = await client.query('INSERT INTO master_positions (name) OUTPUT INSERTED.id VALUES ($1)', [name]);
        }
        const posId = masterPosRes.rows[0].id;
        await client.query('UPDATE users SET position_id = $1 WHERE position = $2', [posId, name]);
      }

      // 4. Migrate Grades (from grade)
      logger.info('Migrating grades...');
      const gradeRes = await client.query('SELECT DISTINCT grade FROM users WHERE grade IS NOT NULL AND grade != \'\'');
      for (const row of gradeRes.rows) {
        const name = row.grade;
        let masterGradeRes = await client.query('SELECT id FROM master_grades WHERE name = $1', [name]);
        if (masterGradeRes.rows.length === 0) {
          masterGradeRes = await client.query('INSERT INTO master_grades (name) OUTPUT INSERTED.id VALUES ($1)', [name]);
        }
        const gradeId = masterGradeRes.rows[0].id;
        await client.query('UPDATE users SET grade_id = $1 WHERE grade = $2', [gradeId, name]);
      }

      // 5. Migrate Employee Types (from emp_type or job_type)
      logger.info('Migrating employee types...');
      // Merge unique values from both emp_type and job_type
      const empTypeRes = await client.query(`
        SELECT DISTINCT emp_type as type_name FROM users WHERE emp_type IS NOT NULL AND emp_type != ''
        UNION
        SELECT DISTINCT job_type as type_name FROM users WHERE job_type IS NOT NULL AND job_type != ''
      `);
      for (const row of empTypeRes.rows) {
        const name = row.type_name;
        let masterEmpTypeRes = await client.query('SELECT id FROM master_employee_types WHERE name = $1', [name]);
        if (masterEmpTypeRes.rows.length === 0) {
          masterEmpTypeRes = await client.query('INSERT INTO master_employee_types (name) OUTPUT INSERTED.id VALUES ($1)', [name]);
        }
      }
      
      // Update emp_type_id based on emp_type (primary) or job_type (fallback)
      await client.query(`
        UPDATE u
        SET emp_type_id = met.id
        FROM users u
        INNER JOIN master_employee_types met ON met.name = COALESCE(NULLIF(u.emp_type, ''), NULLIF(u.job_type, ''))
        WHERE u.emp_type_id IS NULL
      `);

      // 6. Migrate Cost Centers (from cost_center_name)
      logger.info('Migrating cost centers...');
      const ccRes = await client.query('SELECT DISTINCT cost_center_name FROM users WHERE cost_center_name IS NOT NULL AND cost_center_name != \'\'');
      for (const row of ccRes.rows) {
        const name = row.cost_center_name;
        let masterCcRes = await client.query('SELECT id FROM master_cost_centers WHERE name = $1', [name]);
        if (masterCcRes.rows.length === 0) {
          const code = 'CC-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          masterCcRes = await client.query('INSERT INTO master_cost_centers (code, name) OUTPUT INSERTED.id VALUES ($1, $2)', [code, name]);
        }
        const ccId = masterCcRes.rows[0].id;
        await client.query('UPDATE users SET cost_center_id = $1 WHERE cost_center_name = $2', [ccId, name]);
      }
      
    });

    logger.info('Legacy master data migration completed successfully.');
  } catch (error) {
    logger.error('Error migrating legacy master data', { error });
    process.exit(1);
  } finally {
    await db.close();
  }
}

migrateLegacyData();
