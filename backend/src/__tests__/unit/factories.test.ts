/**
 * Unit Tests: Test Data Factories
 *
 * Verifies that each factory produces objects with the expected shape and
 * that the in-memory builders do NOT require a database connection.
 *
 * Requirements: 12.5
 */

import {
  buildUser,
  buildDisabledUser,
  buildSuspendedUser,
  buildLoggedInUser,
  resetUserCounter,
} from '../factories/userFactory';

import {
  buildProvider,
  buildSamlProvider,
  buildOAuthProvider,
  buildLdapProvider,
  buildDisabledProvider,
  resetProviderCounter,
} from '../factories/providerFactory';

import { buildSession, buildExpiredSession } from '../factories/sessionFactory';
import { buildGroup, buildRole, buildPermission, resetGroupCounters } from '../factories/groupFactory';

// ── User factory ──────────────────────────────────────────────────────────────

describe('userFactory', () => {
  beforeEach(() => resetUserCounter());

  describe('buildUser', () => {
    it('returns a user with all required fields', () => {
      const user = buildUser();
      expect(user.id).toBeTruthy();
      expect(user.email).toMatch(/@example\.com$/);
      expect(user.username).toBeTruthy();
      expect(user.first_name).toBeTruthy();
      expect(user.last_name).toBeTruthy();
      expect(user.status).toBe('active');
      expect(user.password_hash).toBeNull();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
      expect(user.last_login_at).toBeNull();
    });

    it('applies overrides correctly', () => {
      const user = buildUser({ status: 'disabled', email: 'custom@test.com' });
      expect(user.status).toBe('disabled');
      expect(user.email).toBe('custom@test.com');
    });

    it('generates unique ids for each call', () => {
      const a = buildUser();
      const b = buildUser();
      expect(a.id).not.toBe(b.id);
      expect(a.email).not.toBe(b.email);
    });
  });

  describe('buildDisabledUser', () => {
    it('returns status: disabled', () => {
      expect(buildDisabledUser().status).toBe('disabled');
    });
  });

  describe('buildSuspendedUser', () => {
    it('returns status: suspended', () => {
      expect(buildSuspendedUser().status).toBe('suspended');
    });
  });

  describe('buildLoggedInUser', () => {
    it('returns a non-null last_login_at', () => {
      const user = buildLoggedInUser();
      expect(user.last_login_at).toBeInstanceOf(Date);
    });
  });
});

// ── Provider factory ──────────────────────────────────────────────────────────

describe('providerFactory', () => {
  beforeEach(() => resetProviderCounter());

  describe('buildProvider', () => {
    it('returns a provider with required fields', () => {
      const p = buildProvider();
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.type).toBe('saml');
      expect(p.status).toBe('enabled');
      expect(p.configuration).toBeDefined();
    });
  });

  describe('buildSamlProvider', () => {
    it('returns type: saml with ssoUrl in configuration', () => {
      const p = buildSamlProvider();
      expect(p.type).toBe('saml');
      expect(p.configuration).toHaveProperty('ssoUrl');
      expect(p.configuration).toHaveProperty('entityId');
    });
  });

  describe('buildOAuthProvider', () => {
    it('returns type: oauth with required OAuth fields', () => {
      const p = buildOAuthProvider();
      expect(p.type).toBe('oauth');
      expect(p.configuration).toHaveProperty('clientId');
      expect(p.configuration).toHaveProperty('authorizationUrl');
      expect(p.configuration).toHaveProperty('tokenUrl');
    });

    it('does NOT include clientSecret in configuration by default', () => {
      const p = buildOAuthProvider();
      // Sensitive data should not be in plain text factory defaults
      expect(p.configuration).not.toHaveProperty('clientSecret');
    });
  });

  describe('buildLdapProvider', () => {
    it('returns type: ldap with host/searchBase in configuration', () => {
      const p = buildLdapProvider();
      expect(p.type).toBe('ldap');
      expect(p.configuration).toHaveProperty('host');
      expect(p.configuration).toHaveProperty('searchBase');
    });
  });

  describe('buildDisabledProvider', () => {
    it('returns status: disabled', () => {
      expect(buildDisabledProvider().status).toBe('disabled');
    });
  });
});

// ── Session factory ───────────────────────────────────────────────────────────

describe('sessionFactory', () => {
  it('buildSession returns a session with expires_at in the future', () => {
    const session = buildSession({ user_id: 'test-user-id' });
    expect(session.id).toBeTruthy();
    expect(session.user_id).toBe('test-user-id');
    expect(session.access_token).toBeTruthy();
    expect(session.expires_at.getTime()).toBeGreaterThan(Date.now());
  });

  it('buildExpiredSession returns a session with expires_at in the past', () => {
    const session = buildExpiredSession({ user_id: 'test-user-id' });
    expect(session.expires_at.getTime()).toBeLessThan(Date.now());
  });

  it('buildSession applies overrides', () => {
    const futureDate = new Date(Date.now() + 9999999);
    const session = buildSession({
      user_id: 'u1',
      ip_address: '10.0.0.1',
      expires_at: futureDate,
    });
    expect(session.ip_address).toBe('10.0.0.1');
    expect(session.expires_at).toBe(futureDate);
  });
});

// ── Group / Role / Permission factory ─────────────────────────────────────────

describe('groupFactory', () => {
  beforeEach(() => resetGroupCounters());

  it('buildGroup returns a group with required fields', () => {
    const g = buildGroup();
    expect(g.id).toBeTruthy();
    expect(g.name).toBeTruthy();
    expect(g.parent_group_id).toBeNull();
  });

  it('buildGroup supports parent_group_id override', () => {
    const parent = buildGroup();
    const child = buildGroup({ parent_group_id: parent.id });
    expect(child.parent_group_id).toBe(parent.id);
  });

  it('buildRole returns a role with required fields', () => {
    const r = buildRole();
    expect(r.id).toBeTruthy();
    expect(r.name).toBeTruthy();
  });

  it('buildPermission returns a permission with required fields', () => {
    const p = buildPermission();
    expect(p.id).toBeTruthy();
    expect(p.resource).toBeTruthy();
    expect(p.action).toBeTruthy();
    expect(p.scope).toBe('global');
  });

  it('buildPermission applies overrides', () => {
    const p = buildPermission({ resource: 'users', action: 'delete', scope: 'own' });
    expect(p.resource).toBe('users');
    expect(p.action).toBe('delete');
    expect(p.scope).toBe('own');
  });
});
