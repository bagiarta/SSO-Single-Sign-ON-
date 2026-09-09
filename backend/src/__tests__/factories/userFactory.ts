/**
 * User Test Data Factory
 *
 * Generates deterministic or randomised User objects for use in tests.
 * All fields have sensible defaults so callers only need to override
 * what matters for the specific test scenario.
 *
 * Usage:
 *
 *   // Build an in-memory object (no DB interaction)
 *   const user = buildUser();
 *   const adminUser = buildUser({ status: 'active', role: 'admin' });
 *
 *   // Insert into the test database and return the persisted row
 *   const user = await createUser(pool);
 *   const disabled = await createUser(pool, { status: 'disabled' });
 */

import { any, any } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  status: 'active' | 'disabled' | 'suspended';
  password_hash: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export type PartialUserRow = Partial<Omit<UserRow, 'id' | 'created_at' | 'updated_at'>>;

// ── Counter for unique values ────────────────────────────────────────────────

let _counter = 0;
function nextId(): number {
  return ++_counter;
}

/** Reset the internal sequence counter (useful between test suites). */
export function resetUserCounter(): void {
  _counter = 0;
}

// ── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build an in-memory UserRow object with default values.
 * Override any field by passing a partial object.
 */
export function buildUser(overrides: PartialUserRow = {}): UserRow {
  const n = nextId();
  return {
    id: uuidv4(),
    email: `user${n}@example.com`,
    username: `testuser${n}`,
    first_name: `First${n}`,
    last_name: `Last${n}`,
    status: 'active',
    password_hash: null,
    created_at: new Date(),
    updated_at: new Date(),
    last_login_at: null,
    ...overrides,
  };
}

// ── Database helpers ─────────────────────────────────────────────────────────

/**
 * Insert a user row into the test database and return the persisted row.
 *
 * @param db   A any or any from testDatabase helpers.
 * @param overrides  Optional field overrides.
 */
export async function createUser(
  db: any,
  overrides: PartialUserRow = {},
): Promise<UserRow> {
  const user = buildUser(overrides);

  const result = await db.query<UserRow>(
    `INSERT INTO users
       (id, email, username, first_name, last_name, status, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      user.id,
      user.email,
      user.username,
      user.first_name,
      user.last_name,
      user.status,
      user.password_hash,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createUser: INSERT returned no rows');
  }
  return row;
}

/**
 * Insert multiple users in a single batch and return all persisted rows.
 */
export async function createUsers(
  db: any,
  count: number,
  overrides: PartialUserRow = {},
): Promise<UserRow[]> {
  const inserts: Promise<UserRow>[] = [];
  for (let i = 0; i < count; i++) {
    inserts.push(createUser(db, overrides));
  }
  return Promise.all(inserts);
}

// ── Convenience builders ─────────────────────────────────────────────────────

/** Build a user with status 'disabled'. */
export function buildDisabledUser(overrides: PartialUserRow = {}): UserRow {
  return buildUser({ ...overrides, status: 'disabled' });
}

/** Build a user with status 'suspended'. */
export function buildSuspendedUser(overrides: PartialUserRow = {}): UserRow {
  return buildUser({ ...overrides, status: 'suspended' });
}

/** Build a user that has a last_login_at timestamp. */
export function buildLoggedInUser(overrides: PartialUserRow = {}): UserRow {
  return buildUser({ ...overrides, last_login_at: new Date() });
}
