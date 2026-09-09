/**
 * Integration Tests: Health Check Endpoints
 *
 * Validates that the Express application is wired up correctly and that
 * the health endpoints respond with the expected status codes and payload
 * shapes.  These tests run against the in-memory test application
 * (no live database required) so they are fast and self-contained.
 *
 * Requirements: 12.1, 12.5
 */

import request from 'supertest';
import { createTestApp } from '../helpers/testApp';

const app = createTestApp();

// ── /health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 or 503 with a status field', async () => {
    const res = await request(app).get('/health').expect('Content-Type', /json/);

    // The health router checks live DB/Redis; those may not be available in CI.
    // We accept either 200 (healthy) or 503 (service unavailable).
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ── /health/live ──────────────────────────────────────────────────────────────

describe('GET /health/live', () => {
  it('always returns 200 with alive: true', async () => {
    const res = await request(app)
      .get('/health/live')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toMatchObject({
      alive: true,
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.pid).toBe('number');
  });
});

// ── /api/status ───────────────────────────────────────────────────────────────

describe('GET /api/status', () => {
  it('returns 200 with API info', async () => {
    const res = await request(app)
      .get('/api/status')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toMatchObject({
      message: 'Enterprise SSO Management API',
      version: '1.0.0',
    });
    expect(typeof res.body.environment).toBe('string');
  });
});

// ── 404 handling ──────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 with a NOT_FOUND error body', async () => {
    const res = await request(app)
      .get('/this-endpoint-does-not-exist')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(res.body).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
    expect(typeof res.body.error.timestamp).toBe('string');
  });
});

// ── Request headers ───────────────────────────────────────────────────────────

describe('Security headers', () => {
  it('includes X-Content-Type-Options header (helmet)', async () => {
    const res = await request(app).get('/health/live').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
