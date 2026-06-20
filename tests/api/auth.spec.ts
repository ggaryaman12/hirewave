import { expect, test } from '@playwright/test';
import crypto from 'crypto';

function email() {
  return `student-${crypto.randomBytes(5).toString('hex')}@test.local`;
}

test.describe('auth (phase 1)', () => {
  test('signup creates a student account', async ({ request }) => {
    const res = await request.post('/api/auth/signup', {
      data: { name: 'Test Student', email: email(), password: 'password123' },
    });
    expect(res.status()).toBe(201);
  });

  test('signup rejects duplicate email with 409', async ({ request }) => {
    const e = email();
    const first = await request.post('/api/auth/signup', { data: { name: 'A', email: e, password: 'password123' } });
    expect(first.status()).toBe(201);
    const dup = await request.post('/api/auth/signup', { data: { name: 'A', email: e, password: 'password123' } });
    expect(dup.status()).toBe(409);
  });

  test('signup rejects weak/invalid input with 400', async ({ request }) => {
    const short = await request.post('/api/auth/signup', { data: { name: 'A', email: email(), password: 'short' } });
    expect(short.status()).toBe(400);
    const bad = await request.post('/api/auth/signup', { data: { name: '', email: 'not-an-email', password: 'password123' } });
    expect(bad.status()).toBe(400);
  });

  test('middleware redirects unauthenticated dashboard access to /login', async ({ request }) => {
    const res = await request.get('/dashboard', { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()['location']).toContain('/login');
  });

  test('dev demo sign-in establishes a recruiter session redirecting to dashboard', async ({ request }) => {
    const res = await request.get('/api/auth/demo?next=/dashboard', { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()['location']).toContain('/dashboard');
    expect(res.headers()['set-cookie'] || '').toContain('authjs');
  });
});
