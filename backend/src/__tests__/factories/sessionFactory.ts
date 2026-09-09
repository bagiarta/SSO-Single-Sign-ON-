/**
 * User Session Test Data Factory
 *
 * Generates UserSession rows for use in tests, including helpers for
 * creating expired sessions (used in cleanup and revocation tests).
 *
 * Usage:
 *
 *   const session = buildSession({ userId, providerId });
 *   const expired = buildExpiredSession({ userId, providerId });
 *   const persisted = await createSession(pool, { userId, providerId });
 */

import { any, any } from 'pg';
import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: string;
  provider_id: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: Date;
  created_at: Date;
  last_accessed_at: Date;
  ip_address: string;
  user_agent: string | null;
  attributes: Record<string, unknown>;
}

export type PartialSessionRow = Partial<
  Omit<SessionRow, 'id' | 'created_at' | 'last_accessed_at'>
> & {
  user_id: string; // required
};

// ── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build an in-memory SessionRow with sensible defaults.
 * `user_id` must be provided (it references the users table).
 */
export function buildSession(overrides: PartialSessionRow): SessionRow {
  const futureDate = new Date(Date.now() + 3600 * 1000); // +1 hour
  return {
    id: uuidv4(),
    user_id: overrides.user_id,
    provider_id: overrides.provider_id ?? null,
    access_token: overrides.access_token ?? `access-token-${uuidv4()}`,
    refresh_token: overrides.refresh_token ?? null,
    expires_at: overrides.expires_at ?? futureDate,
    created_at: new Date(),
    last_accessed_at: new Date(),
    ip_address: overrides.ip_address ?? '127.0.0.1',
    user_agent: overrides.user_agent ?? 'jest-test-agent/1.0',
    attributes: overrides.attributes ?? {},
  };
}

/**
 * Build an expired session (expires_at in the past).
 */
export function buildExpiredSession(overrides: PartialSessionRow): SessionRow {
  const pastDate = new Date(Date.now() - 3600 * 1000); // -1 hour
  return buildSession({ ...overrides, expires_at: pastDate });
}

// ── Database helpers ─────────────────────────────────────────────────────────

/**
 * Insert a session into the test database and return the persisted row.
 */
export async function createSession(
  db: any,
  overrides: PartialSessionRow,
): Promise<SessionRow> {
  const session = buildSession(overrides);

  const result = await db.query<SessionRow>(
    `INSERT INTO user_sessions
       (id, user_id, provider_id, access_token, refresh_token,
        expires_at, ip_address, user_agent, attributes)
     VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8, $9)
     RETURNING *`,
    [
      session.id,
      session.user_id,
      session.provider_id,
      session.access_token,
      session.refresh_token,
      session.expires_at,
      session.ip_address,
      session.user_agent,
      JSON.stringify(session.attributes),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createSession: INSERT returned no rows');
  }
  return row;
}

/**
 * Insert an expired session into the test database.
 */
export async function createExpiredSession(
  db: any,
  overrides: PartialSessionRow,
): Promise<SessionRow> {
  const pastDate = new Date(Date.now() - 3600 * 1000);
  return createSession(db, { ...overrides, expires_at: pastDate });
}

/**
 * Insert multiple sessions for the same user.
 */
export async function createSessionsForUser(
  db: any,
  userId: string,
  count: number,
  overrides: Partial<PartialSessionRow> = {},
): Promise<SessionRow[]> {
  const inserts: Promise<SessionRow>[] = [];
  for (let i = 0; i < count; i++) {
    inserts.push(createSession(db, { ...overrides, user_id: userId }));
  }
  return Promise.all(inserts);
}
