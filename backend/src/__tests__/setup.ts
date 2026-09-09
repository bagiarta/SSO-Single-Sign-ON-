/**
 * Global Jest Setup
 *
 * This file is executed ONCE before all test suites (globalSetup).
 * It configures the test environment variables so that the config
 * module picks them up when test files are first imported.
 *
 * NOTE: Because this runs in a separate Node context from the tests,
 * it cannot use module imports from the project directly. Its job is
 * purely to set process.env for the test run.
 */

export default async function globalSetup(): Promise<void> {
  // Ensure we are in test mode
  process.env['NODE_ENV'] = 'test';

  // ── Database ──────────────────────────────────────────────────────────────
  // Use a dedicated test database so tests never touch dev/prod data.
  process.env['DB_HOST'] = process.env['TEST_DB_HOST'] ?? '192.168.85.29';
  process.env['DB_PORT'] = process.env['TEST_DB_PORT'] ?? '1433';
  process.env['DB_NAME'] = process.env['TEST_DB_NAME'] ?? 'SSO_PPT';
  process.env['DB_USER'] = process.env['TEST_DB_USER'] ?? 'PEPITO_SSO';
  process.env['DB_PASSWORD'] = process.env['TEST_DB_PASSWORD'] ?? 'PEPITO_SSO';
  process.env['DB_SSL'] = 'false';
  process.env['DB_MAX_CONNECTIONS'] = '5';

  // ── Redis ─────────────────────────────────────────────────────────────────
  // Use a separate Redis DB index for tests (default: db 1) to avoid
  // polluting the development cache (db 0).
  process.env['REDIS_HOST'] = process.env['TEST_REDIS_HOST'] ?? 'localhost';
  process.env['REDIS_PORT'] = process.env['TEST_REDIS_PORT'] ?? '6379';
  process.env['REDIS_DB'] = process.env['TEST_REDIS_DB'] ?? '1';
  process.env['REDIS_PASSWORD'] = process.env['TEST_REDIS_PASSWORD'] ?? '';
  process.env['REDIS_TTL'] = '60';

  // ── JWT / Session / Encryption ────────────────────────────────────────────
  process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-only-32ch';
  process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-key-for-testing-32ch';
  process.env['JWT_EXPIRES_IN'] = '1h';
  process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
  process.env['JWT_ISSUER'] = 'enterprise-sso-system';
  process.env['JWT_AUDIENCE'] = 'sso-users';

  process.env['SESSION_SECRET'] = 'test-session-secret-key-for-testing-ok';
  process.env['SESSION_TIMEOUT'] = '3600';
  process.env['SESSION_CLEANUP_INTERVAL'] = '300';

  process.env['ENCRYPTION_KEY'] = 'test-encryption-key-32-chars-1234';

  // ── Server ────────────────────────────────────────────────────────────────
  process.env['PORT'] = '3099'; // Dedicated test port
  process.env['HOST'] = 'localhost';
  process.env['CORS_ORIGIN'] = 'http://localhost:3000';

  // ── Logging ───────────────────────────────────────────────────────────────
  // Suppress noisy logging during tests; write to a test-specific directory.
  process.env['LOG_LEVEL'] = 'error';
  process.env['LOG_FILE_PATH'] = './logs/test';

  // ── Security ──────────────────────────────────────────────────────────────
  process.env['BCRYPT_ROUNDS'] = '4'; // Fast hashing for tests
  process.env['RATE_LIMIT_MAX_REQUESTS'] = '1000';
  process.env['MAX_LOGIN_ATTEMPTS'] = '10';

  // ── Features ─────────────────────────────────────────────────────────────
  process.env['AUTO_MIGRATE'] = 'false';
  process.env['METRICS_ENABLED'] = 'false';
}
