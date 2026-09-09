import { db, query } from './src/database/connection';
import bcrypt from 'bcryptjs';

async function insertAdmin() {
  await db.connect();
  const hash = await bcrypt.hash('12345678', 12);
  const email = 'it4.pepito@rcoid.com';
  
  const check = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (check.rows.length === 0) {
    await query(`
      INSERT INTO users (email, username, first_name, last_name, status, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [email, 'it4.pepito', 'IT4', 'Pepito', 'active', hash]);
    console.log('User created successfully');
  } else {
    console.log('User already exists');
  }
  await db.close();
}

insertAdmin().catch(console.error);
