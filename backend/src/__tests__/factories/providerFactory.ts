/**
 * Identity Provider Test Data Factory
 *
 * Generates IdentityProvider rows for use in tests.
 * Supports SAML, OAuth, and LDAP provider types with realistic defaults.
 *
 * Usage:
 *
 *   // Build in-memory objects
 *   const saml = buildSamlProvider();
 *   const oauth = buildOAuthProvider({ status: 'disabled' });
 *   const ldap = buildLdapProvider();
 *
 *   // Persist to the test database
 *   const provider = await createProvider(pool);
 *   const oauth = await createProvider(pool, buildOAuthProvider());
 */

import { v4 as uuidv4 } from 'uuid';

// ── Types ────────────────────────────────────────────────────────────────────

export type ProviderType = 'saml' | 'oauth' | 'ldap';
export type ProviderStatus = 'enabled' | 'disabled' | 'error';

export interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus;
  configuration: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  last_validated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PartialProviderRow = Partial<
  Omit<ProviderRow, 'id' | 'created_at' | 'updated_at'>
>;

// ── Counter ──────────────────────────────────────────────────────────────────

let _counter = 0;
function nextId(): number {
  return ++_counter;
}

/** Reset the internal sequence counter (useful between test suites). */
export function resetProviderCounter(): void {
  _counter = 0;
}

// ── Generic builder ──────────────────────────────────────────────────────────

/**
 * Build a generic IdentityProvider row with sensible defaults.
 * Use the type-specific builders below for more convenient defaults.
 */
export function buildProvider(overrides: PartialProviderRow = {}): ProviderRow {
  const n = nextId();
  return {
    id: uuidv4(),
    name: `test-provider-${n}`,
    type: 'saml',
    status: 'enabled',
    configuration: {},
    metadata: null,
    last_validated_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Type-specific builders ───────────────────────────────────────────────────

/** Build a SAML provider with realistic configuration defaults. */
export function buildSamlProvider(overrides: PartialProviderRow = {}): ProviderRow {
  const n = nextId();
  return {
    id: uuidv4(),
    name: `saml-provider-${n}`,
    type: 'saml',
    status: 'enabled',
    configuration: {
      ssoUrl: `https://idp-${n}.example.com/sso`,
      sloUrl: `https://idp-${n}.example.com/slo`,
      certificateFingerprint: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD',
      signatureMethod: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      entityId: `https://idp-${n}.example.com`,
    },
    metadata: {
      entityDescriptor: `<EntityDescriptor entityID="https://idp-${n}.example.com"/>`,
    },
    last_validated_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Build an OAuth 2.0 / OpenID Connect provider with realistic defaults. */
export function buildOAuthProvider(overrides: PartialProviderRow = {}): ProviderRow {
  const n = nextId();
  return {
    id: uuidv4(),
    name: `oauth-provider-${n}`,
    type: 'oauth',
    status: 'enabled',
    configuration: {
      clientId: `client-id-${n}`,
      // Note: client secret is intentionally NOT stored in plain text in exports
      authorizationUrl: `https://auth-${n}.example.com/authorize`,
      tokenUrl: `https://auth-${n}.example.com/token`,
      userinfoUrl: `https://auth-${n}.example.com/userinfo`,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: 'http://localhost:3099/auth/oauth/callback',
    },
    metadata: null,
    last_validated_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Build an LDAP provider with realistic configuration defaults. */
export function buildLdapProvider(overrides: PartialProviderRow = {}): ProviderRow {
  const n = nextId();
  return {
    id: uuidv4(),
    name: `ldap-provider-${n}`,
    type: 'ldap',
    status: 'enabled',
    configuration: {
      host: `ldap-${n}.example.com`,
      port: 389,
      bindDn: `cn=sso-service,ou=serviceaccounts,dc=example,dc=com`,
      searchBase: `ou=users,dc=example,dc=com`,
      searchFilter: '(uid={{username}})',
      useTls: false,
      timeout: 5000,
    },
    metadata: null,
    last_validated_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/** Build a disabled provider of any type. */
export function buildDisabledProvider(overrides: PartialProviderRow = {}): ProviderRow {
  return buildProvider({ ...overrides, status: 'disabled' });
}

// ── Database helpers ─────────────────────────────────────────────────────────

/**
 * Insert a provider into the test database and return the persisted row.
 * Defaults to a generic SAML provider if no override is supplied.
 */
export async function createProvider(
  db: any,
  overrides: PartialProviderRow | ProviderRow = {},
): Promise<ProviderRow> {
  // Determine whether the caller passed a fully-built provider or just overrides
  const provider =
    'type' in overrides && 'name' in overrides && 'configuration' in overrides
      ? (overrides as ProviderRow)
      : buildProvider(overrides as PartialProviderRow);

  const result = await db.query<ProviderRow>(
    `INSERT INTO identity_providers
       (id, name, type, status, configuration, metadata, last_validated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      provider.id,
      provider.name,
      provider.type,
      provider.status,
      JSON.stringify(provider.configuration),
      provider.metadata ? JSON.stringify(provider.metadata) : null,
      provider.last_validated_at,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('createProvider: INSERT returned no rows');
  }
  return row;
}

/**
 * Insert multiple providers and return all persisted rows.
 */
export async function createProviders(
  db: any,
  count: number,
  overrides: PartialProviderRow = {},
): Promise<ProviderRow[]> {
  const inserts: Promise<ProviderRow>[] = [];
  for (let i = 0; i < count; i++) {
    inserts.push(createProvider(db, overrides));
  }
  return Promise.all(inserts);
}
