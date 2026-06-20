import { expect, test } from '@playwright/test';
import { Judge0Provider } from '../../lib/judge/judge0-provider';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const input = { language: 'cpp', source: 'int main(){}', stdin: '1 2\n', timeLimitMs: 2000, memoryLimitMb: 256 };

test.describe('Judge0Provider (hardened)', () => {
  test('encodes source/stdin as base64 and decodes base64 output', async () => {
    let sentBody: any = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return jsonResponse({ status: { id: 3 }, stdout: b64('hello world\n'), stderr: '', time: '0.01', memory: 1024, exit_code: 0 });
    }) as unknown as typeof fetch;

    const provider = new Judge0Provider({ baseUrl: 'http://judge0.test', fetchImpl });
    const result = await provider.run(input);

    expect(sentBody.source_code).toBe(b64('int main(){}'));
    expect(sentBody.stdin).toBe(b64('1 2\n'));
    expect(result.status).toBe('ok');
    expect(result.stdout).toBe('hello world\n');
    expect(result.runtimeMs).toBe(10);
  });

  test('retries on HTTP 429 then succeeds', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls < 3) return new Response('rate limited', { status: 429 });
      return jsonResponse({ status: { id: 3 }, stdout: b64('ok'), time: '0', memory: 0 });
    }) as unknown as typeof fetch;

    const provider = new Judge0Provider({ baseUrl: 'http://judge0.test', fetchImpl, maxAttempts: 5 });
    const result = await provider.run(input);
    expect(calls).toBe(3);
    expect(result.status).toBe('ok');
    expect(result.stdout).toBe('ok');
  });

  test('polls when wait response is still queued', async () => {
    let calls = 0;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls += 1;
      if (init.method === 'POST') return jsonResponse({ status: { id: 1 }, token: 'tok-123' }); // queued
      // GET poll
      if (calls === 2) return jsonResponse({ status: { id: 2 } }); // processing
      return jsonResponse({ status: { id: 3 }, stdout: b64('done'), time: '0', memory: 0 });
    }) as unknown as typeof fetch;

    const provider = new Judge0Provider({ baseUrl: 'http://judge0.test', fetchImpl, pollAttempts: 5 });
    const result = await provider.run(input);
    expect(result.status).toBe('ok');
    expect(result.stdout).toBe('done');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  test('surfaces a clear error when Judge0 is unreachable', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    const provider = new Judge0Provider({ baseUrl: 'http://judge0.test', fetchImpl, maxAttempts: 2 });
    const result = await provider.run(input);
    expect(result.status).toBe('error');
    expect(result.stderr).toContain('ECONNREFUSED');
  });
});
