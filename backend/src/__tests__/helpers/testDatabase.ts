/**
 * Test Database Utilities
 *
 * Provides helpers for connecting to / disconnecting from the test PostgreSQL
 * database and for cleaning up tables between tests so each suite starts from
 * a known empty state.
 *
 * Usage in a test file:
 *
 *   import { connectTestDatabase, disconnectTestDatabase, cleanDatabase } from '../helpers/testDatabase';
 *
 *   beforeAll(async () => { await connectTestDatabase(); });
 *   afterAll(async () => { await disconnectTestDatabase(); });
 *   afterEach(async () => { await cleanDatabase(); });
 */

import { any, any } from 'pg';

// ── Connection pool ──────────────────────────────────────────────────────────

let pool: any | null = null;

/**
 * Create (or reuse) a connection pool pointing at the test database.
 * The connection parameters are taken from the environment variables set by
 * the global Jest setup file (src/__tests__/setup.ts).
 */
export async function connectTestDatabase(): Promise<void> {
  if (pool) {
    return; // already connected
  }

  pool = new any({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    database: process.env['DB_NAME'] ?? 'enterprise_sso_test',
    user: process.env['DB_USER'] ?? 'sso_user',
    password: process.env['DB_PASSWORD'] ?? 'sso_password_dev',
    ssl: false,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  // Verify connectivity
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
}

/**
 * End all connections in the pool.
 * Call this in afterAll() to avoid Jest "open handles" warnings.
 */
export async function disconnectTestDatabase(): Promise<void> {
  if (!pool) {
    return;
  }
  await pool.end();
  pool = null;
}

/**
 * Return the current pool, throwing if it has not been initialised.
 */
export function getTestany(): any {
  if (!pool) {
    throw new Error(
      'Test database pool is not initialised. ' +
      'Call connectTestDatabase() in beforeAll().',
    );
  }
  return pool;
}

// ── Query helpers ────────────────────────────────────────────────────────────

/**
 * Execute a SQL query against the test database and return the result rows.
 */
export async function testQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const p = getTestany();
  const result = await p.query<T>(text, params);
  return result.rows;
}

/**
 * Execute a callback inside a database transaction that is always rolled back.
 * Useful for tests that need to verify side-effects without persisting data.
 */
export async function withRollback(
  callback: (client: any) => Promise<void>,
): Promise<void> {
  const p = getTestany();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    await callback(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

// ── Table truncation ─────────────────────────────────────────────────────────

/**
 * Tables listed in the order they should be truncated (leaf tables first so
 * FK constraints are satisfied).  Extend this list as new tables are added
 * via migrations.
 */
const TRUNCATION_ORDER: readonly string[] = [
  'audit_logs',
  'api_tokens',
  'user_sessions',
  'user_providers',
  'role_permissions',
  'group_roles',
  'user_roles',
  'user_groups',
  'permissions',
  'roles',
  'groups',
  'identity_providers',
  'users',
];

/**
 * Truncate all application tables in the test database.
 *
 * Pass a subset of table names if you only want to clear specific tables.
 * Uses TRUNCATE … CASCADE to handle any remaining FK dependencies.
 */
export async function cleanDatabase(tables?: string[]): Promise<void> {
  const p = getTestany();
  const target = tables ?? [...TRUNCATION_ORDER];

  if (target.length === 0) {
    return;
  }

  // Sanitise table names (allow only alphanumeric + underscore)
  const safe = target.map(t => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) {
      throw new Error(`Unsafe table name: ${t}`);
    }
    return t;
  });

  const sql = `TRUNCATE TABLE ${safe.join(', ')} RESTART IDENTITY CASCADE`;
  await p.query(sql);
}

/**
 * Truncate only the tables that actually exist in the current schema.
 * Safe to call even before migrations have been run.
 */
export async function cleanExistingTables(): Promise<void> {
  const p = getTestany();

  const result = await p.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('pgmigrations')`,
  );

  const existingTables = result.rows.map(r => r.table_name);
  const toTruncate = TRUNCATION_ORDER.filter(t => existingTables.includes(t));

  if (toTruncate.length > 0) {
    const safe = toTruncate.join(', ');
    await p.query(`TRUNCATE TABLE ${safe} RESTART IDENTITY CASCADE`);
  }
}

// ── Schema creation helpers ──────────────────────────────────────────────────

/**
 * Create a minimal set of tables required by tests that run before the full
 * migration suite.  Call this in beforeAll() when you need table access but
 * don't want to run the full migration stack.
 */
export async function createTestSchema(): Promise<void> {
  const p = getTestany();

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      password_hash VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      last_login_at TIMESTAMP,
      CONSTRAINT valid_status CHECK (status IN ('active', 'disabled', 'suspended'))
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS identity_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      type VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'enabled',
      configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB,
      last_validated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT valid_type CHECK (type IN ('saml', 'oauth', 'ldap')),
      CONSTRAINT valid_status CHECK (status IN ('enabled', 'disabled', 'error'))
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      parent_group_id UUID REFERENCES groups(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      resource VARCHAR(100) NOT NULL,
      action VARCHAR(50) NOT NULL,
      scope VARCHAR(100) DEFAULT 'global',
      UNIQUE(resource, action, scope)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS user_groups (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, group_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, role_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS group_roles (
      group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (group_id, role_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS user_providers (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      provider_id UUID REFERENCES identity_providers(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, provider_id)
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      provider_id UUID REFERENCES identity_providers(id),
      access_token VARCHAR(512) NOT NULL,
      refresh_token VARCHAR(512),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_accessed_at TIMESTAMP DEFAULT NOW(),
      ip_address INET NOT NULL,
      user_agent TEXT,
      attributes JSONB DEFAULT '{}'::jsonb
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      scopes TEXT[] DEFAULT '{}',
      expires_at TIMESTAMP,
      last_used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type VARCHAR(50) NOT NULL,
      user_id UUID REFERENCES users(id),
      session_id UUID REFERENCES user_sessions(id),
      ip_address INET,
      user_agent TEXT,
      resource VARCHAR(100),
      action VARCHAR(50),
      result VARCHAR(20) NOT NULL,
      details JSONB DEFAULT '{}'::jsonb,
      timestamp TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * Drop all application tables created by createTestSchema().
 * Call this in afterAll() if you want a completely clean slate.
 */
export async function dropTestSchema(): Promise<void> {
  const p = getTestany();
  const tables = [...TRUNCATION_ORDER].reverse();
  const safe = tables.join(', ');
  await p.query(`DROP TABLE IF EXISTS ${safe} CASCADE`);
}
