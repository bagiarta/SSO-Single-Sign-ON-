/**
 * Test Redis Utilities
 *
 * Provides helpers for connecting to / disconnecting from the test Redis
 * instance and for flushing the test database between suites.
 *
 * The test run is configured (in setup.ts) to use Redis DB index 1 so it
 * never affects the development DB (index 0).
 *
 * Usage in a test file:
 *
 *   import { connectTestRedis, disconnectTestRedis, flushTestRedis } from '../helpers/testRedis';
 *
 *   beforeAll(async () => { await connectTestRedis(); });
 *   afterAll(async () => { await disconnectTestRedis(); });
 *   afterEach(async () => { await flushTestRedis(); });
 */

import { createClient, RedisClientType } from 'redis';

// ── Singleton client ─────────────────────────────────────────────────────────

let client: RedisClientType | null = null;

/**
 * Create (or reuse) a Redis client pointed at the test database.
 * Connection parameters are taken from environment variables set in setup.ts.
 */
export async function connectTestRedis(): Promise<void> {
  if (client?.isOpen) {
    return; // already connected
  }

  const options: Parameters<typeof createClient>[0] = {
    socket: {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      connectTimeout: 5000,
    },
    database: parseInt(process.env['REDIS_DB'] ?? '1', 10),
  };

  const password = process.env['REDIS_PASSWORD'];
  if (password && password.length > 0) {
    options.password = password;
  }

  client = createClient(options) as RedisClientType;

  client.on('error', (err: Error) => {
    // Suppress errors during tests; individual operations will throw if needed
    process.stderr.write(`[TestRedis] Error: ${err.message}\n`);
  });

  await client.connect();
}

/**
 * Gracefully disconnect the Redis client.
 * Call this in afterAll() to avoid Jest "open handles" warnings.
 */
export async function disconnectTestRedis(): Promise<void> {
  if (!client?.isOpen) {
    return;
  }
  await client.quit();
  client = null;
}

/**
 * Return the active Redis client, throwing if not yet initialised.
 */
export function getTestRedisClient(): RedisClientType {
  if (!client?.isOpen) {
    throw new Error(
      'Test Redis client is not initialised. ' +
      'Call connectTestRedis() in beforeAll().',
    );
  }
  return client;
}

// ── Flush helpers ────────────────────────────────────────────────────────────

/**
 * Flush ALL keys from the current test Redis database (FLUSHDB).
 * Call this in afterEach() / afterAll() to ensure a clean slate.
 */
export async function flushTestRedis(): Promise<void> {
  const c = getTestRedisClient();
  await c.flushDb();
}

// ── Key-level helpers ────────────────────────────────────────────────────────

/**
 * Set a key in the test Redis database with an optional TTL in seconds.
 */
export async function testRedisSet(
  key: string,
  value: string | object,
  ttlSeconds?: number,
): Promise<void> {
  const c = getTestRedisClient();
  const serialised = typeof value === 'object' ? JSON.stringify(value) : value;
  if (ttlSeconds !== undefined) {
    await c.setEx(key, ttlSeconds, serialised);
  } else {
    await c.set(key, serialised);
  }
}

/**
 * Get a value from the test Redis database.
 * Automatically parses JSON strings.
 */
export async function testRedisGet<T = unknown>(key: string): Promise<T | null> {
  const c = getTestRedisClient();
  const value = await c.get(key);
  if (value === null) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

/**
 * Delete one or more keys from the test Redis database.
 */
export async function testRedisDel(keys: string | string[]): Promise<void> {
  const c = getTestRedisClient();
  const keysArray = Array.isArray(keys) ? keys : [keys];
  await c.del(keysArray);
}

/**
 * Check whether a key exists in the test Redis database.
 */
export async function testRedisExists(key: string): Promise<boolean> {
  const c = getTestRedisClient();
  const count = await c.exists(key);
  return count === 1;
}

/**
 * Return all keys matching a glob-style pattern in the test Redis database.
 */
export async function testRedisKeys(pattern: string): Promise<string[]> {
  const c = getTestRedisClient();
  return c.keys(pattern);
}

/**
 * Return the TTL (in seconds) for a key, or -1 if the key has no expiry,
 * or -2 if the key does not exist.
 */
export async function testRedisTtl(key: string): Promise<number> {
  const c = getTestRedisClient();
  return c.ttl(key);
}

// ── Health check ─────────────────────────────────────────────────────────────

/**
 * Ping the Redis server and return true if it responds correctly.
 */
export async function testRedisPing(): Promise<boolean> {
  try {
    const c = getTestRedisClient();
    const pong = await c.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
