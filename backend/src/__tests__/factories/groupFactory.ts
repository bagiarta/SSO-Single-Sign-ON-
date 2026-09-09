/**
 * Group & Role Test Data Factory
 *
 * Generates Group and Role rows for use in tests, including helpers for
 * nested group hierarchies and role-permission assignments.
 *
 * Usage:
 *
 *   const group = await createGroup(pool);
 *   const child = await createGroup(pool, { parent_group_id: group.id });
 *   const role = await createRole(pool);
 */

import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  parent_group_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PermissionRow {
  id: string;
  resource: string;
  action: string;
  scope: string;
}

export type PartialGroupRow = Partial<Omit<GroupRow, 'id' | 'created_at' | 'updated_at'>>;
export type PartialRoleRow = Partial<Omit<RoleRow, 'id' | 'created_at' | 'updated_at'>>;
export type PartialPermissionRow = Partial<Omit<PermissionRow, 'id'>>;

// ── Counters ─────────────────────────────────────────────────────────────────

let _groupCounter = 0;
let _roleCounter = 0;
let _permCounter = 0;

function nextGroupId(): number { return ++_groupCounter; }
function nextRoleId(): number { return ++_roleCounter; }
function nextPermId(): number { return ++_permCounter; }

export function resetGroupCounters(): void {
  _groupCounter = 0;
  _roleCounter = 0;
  _permCounter = 0;
}

// ── Group builder ─────────────────────────────────────────────────────────────

export function buildGroup(overrides: PartialGroupRow = {}): GroupRow {
  const n = nextGroupId();
  return {
    id: uuidv4(),
    name: `test-group-${n}`,
    description: `Test group ${n}`,
    parent_group_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export async function createGroup(
  db: any,
  overrides: PartialGroupRow = {},
): Promise<GroupRow> {
  const group = buildGroup(overrides);

  const result = await db.query<GroupRow>(
    `INSERT INTO groups (id, name, description, parent_group_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [group.id, group.name, group.description, group.parent_group_id],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createGroup: INSERT returned no rows');
  }
  return row;
}

// ── Role builder ──────────────────────────────────────────────────────────────

export function buildRole(overrides: PartialRoleRow = {}): RoleRow {
  const n = nextRoleId();
  return {
    id: uuidv4(),
    name: `test-role-${n}`,
    description: `Test role ${n}`,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export async function createRole(
  db: any,
  overrides: PartialRoleRow = {},
): Promise<RoleRow> {
  const role = buildRole(overrides);

  const result = await db.query<RoleRow>(
    `INSERT INTO roles (id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [role.id, role.name, role.description],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createRole: INSERT returned no rows');
  }
  return row;
}

// ── Permission builder ────────────────────────────────────────────────────────

export function buildPermission(overrides: PartialPermissionRow = {}): PermissionRow {
  const n = nextPermId();
  return {
    id: uuidv4(),
    resource: `resource-${n}`,
    action: 'read',
    scope: 'global',
    ...overrides,
  };
}

export async function createPermission(
  db: any,
  overrides: PartialPermissionRow = {},
): Promise<PermissionRow> {
  const perm = buildPermission(overrides);

  // Use upsert because (resource, action, scope) must be unique
  const result = await db.query<PermissionRow>(
    `INSERT INTO permissions (id, resource, action, scope)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (resource, action, scope) DO UPDATE
       SET resource = EXCLUDED.resource
     RETURNING *`,
    [perm.id, perm.resource, perm.action, perm.scope],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createPermission: INSERT returned no rows');
  }
  return row;
}

// ── Relationship helpers ──────────────────────────────────────────────────────

/** Assign a user to a group. */
export async function assignUserToGroup(
  db: any,
  userId: string,
  groupId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, groupId],
  );
}

/** Assign a role to a user. */
export async function assignRoleToUser(
  db: any,
  userId: string,
  roleId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, roleId],
  );
}

/** Assign a role to a group. */
export async function assignRoleToGroup(
  db: any,
  groupId: string,
  roleId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO group_roles (group_id, role_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [groupId, roleId],
  );
}

/** Assign a permission to a role. */
export async function assignPermissionToRole(
  db: any,
  roleId: string,
  permissionId: string,
): Promise<void> {
  await db.query(
    `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [roleId, permissionId],
  );
}
