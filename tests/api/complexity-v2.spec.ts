import { test, expect } from '@playwright/test';

test('POST /api/dsa/complexity-v2/[slug] returns a status', async ({ request }) => {
  const res = await request.post('/api/dsa/complexity-v2/reverse-an-array', {
    data: { language: 'javascript', source: 'function reverse(a){let i=0,j=a.length-1;while(i<j){const t=a[i];a[i]=a[j];a[j]=t;i++;j--;}return a;}' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(['done', 'failed', 'unsupported_language']).toContain(body.status);
  if (body.status === 'done') expect(body.summary.bigOTime).toMatch(/O\(/);
});
