import { test } from '@playwright/test';

test.describe('future platform hardening coverage', () => {
  test.skip('real workspace auth blocks dashboard access without a hiring-team session', async () => {
    // Unskip when demo-cookie auth is replaced with production auth.
  });

  test.skip('candidate cannot access another candidate session or report', async () => {
    // Unskip when candidate session tokens gain stricter authorization and ownership checks.
  });

  test.skip('expired invite links cannot start new candidate sessions', async () => {
    // Unskip when invite expiry management is part of the builder UI.
  });

  test.skip('sandbox provider prevents untrusted code from reading platform secrets', async () => {
    // Unskip when E2B, Daytona, Docker-for-dev, or microVM sandbox execution is integrated.
  });

  test.skip('rate limiting protects telemetry, AI, command, and session-start routes', async () => {
    // Unskip when rate limiting middleware or provider-backed limits are introduced.
  });

  test.skip('real AI provider redacts secrets and records model metadata for every response', async () => {
    // Unskip when deterministic AI is replaced by a live provider adapter.
  });
});
