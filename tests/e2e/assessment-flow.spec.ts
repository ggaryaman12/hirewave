import { expect, test, type Page } from '@playwright/test';
import {
  PASSING_CART_TS,
  PASSING_CHECKOUT_TS,
  PASSING_PAYMENT_TS,
  findSessionByToken,
  uniqueTestEmail,
} from '../helpers/session-fixtures';

// Establishes a real recruiter session (dev-only demo sign-in) before touching
// the company dashboard, which is now behind auth.
async function loginAsRecruiter(page: Page) {
  await page.goto('/api/auth/demo?next=/dashboard');
  await page.waitForURL(/\/dashboard/);
}

async function replaceActiveEditor(page: Page, content: string) {
  await page.locator('textarea').first().fill(content);
  await page.waitForTimeout(900);
}

test.describe('candidate assessment flow', () => {
  test('shows the expanded challenge catalog and creates a custom draft template', async ({ page }) => {
    const draftTitle = `Payments Draft ${Date.now()}`;

    await loginAsRecruiter(page);
    await page.goto('/dashboard/assessments/new');
    await expect(page.getByRole('heading', { name: 'Create assessment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Webhook Idempotency And Order State' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Multi-Tenant Permission Leak' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Custom task draft' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Task title' }).fill(draftTitle);
    await page.getByRole('textbox', { name: 'Custom context' }).fill('Provider retries webhooks and some orders are confirmed twice.');
    await page.getByLabel('Task type').selectOption('Bug fix');
    await page.getByLabel('Domain').selectOption('Payments');
    await page.getByLabel('Failure mode').selectOption('Duplicate webhook events');
    await page.getByRole('button', { name: 'Create draft template' }).click();

    await expect(page).toHaveURL(/customChallengeId=/);
    await expect(page.getByText('Draft template ready')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Challenge template' })).toHaveValue(/.+/);
    await expect(page.getByText(draftTitle).first()).toBeVisible();
  });

  test('formats AI markdown responses and shows a waiting state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const candidateName = `Markdown Candidate ${Date.now()}`;
    const candidateEmail = uniqueTestEmail('markdown');
    let releaseResponse: () => void = () => undefined;
    const waitForRelease = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route('**/api/session/**/ai', async (route) => {
      await waitForRelease;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          messages: [
            {
              id: 'user-markdown-test',
              role: 'user',
              content: 'Render this clearly',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'assistant-markdown-test',
              role: 'assistant',
              content: [
                '# Assessment Summary',
                '',
                '1. **Validate cart quantities** — reject invalid values.',
                '2. **Run tests** after every small fix.',
                ...Array.from(
                  { length: 18 },
                  (_, index) => `${index + 3}. **Sidebar scroll checkpoint ${index + 1}** — keep long answers inside the chat panel.`,
                ),
                '',
                '```typescript',
                'if (!Number.isInteger(item.quantity) || item.quantity <= 0) {',
                "  throw new Error('Invalid quantity');",
                '}',
                '```',
              ].join('\n'),
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/invite/demo-invite');
    await page.getByRole('textbox', { name: 'Full name' }).fill(candidateName);
    await page.getByRole('textbox', { name: 'Email' }).fill(candidateEmail);
    await page.getByRole('button', { name: 'Start assessment' }).click();
    await expect(page).toHaveURL(/\/session\/[^/]+$/);

    await page
      .getByRole('textbox', { name: 'Ask for a debugging plan, a review, or a specific hint...' })
      .fill('Render this clearly');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Hirewave AI is thinking')).toBeVisible();
    await expect(page.getByText('Render this clearly')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    releaseResponse();

    await expect(page.getByRole('heading', { name: 'Assessment Summary' })).toBeVisible();
    await expect(page.getByText('Validate cart quantities')).toBeVisible();
    await expect(page.locator('code').filter({ hasText: 'Number.isInteger' })).toBeVisible();
    await expect(page.getByText('```typescript')).toHaveCount(0);
    const chatScroller = page.getByTestId('ai-chat-scroll');
    await expect(chatScroller).toBeVisible();
    await expect.poll(async () => chatScroller.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBeTruthy();
    await expect.poll(async () => chatScroller.evaluate((element) => (
      Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight - 4
    ))).toBeTruthy();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('runs invite to assessment room to report review', async ({ page }) => {
    const candidateName = `E2E Candidate ${Date.now()}`;
    const candidateEmail = uniqueTestEmail('e2e');

    await page.goto('/invite/demo-invite');
    await expect(page.getByRole('heading', { name: 'Full-stack AI Collaboration Screen' })).toBeVisible();
    await expect(page.getByText('Debug the Broken Checkout Flow')).toBeVisible();

    await page.getByRole('textbox', { name: 'Full name' }).fill(candidateName);
    await page.getByRole('textbox', { name: 'Email' }).fill(candidateEmail);
    await page.getByRole('button', { name: 'Start assessment' }).click();

    await expect(page).toHaveURL(/\/session\/[^/]+$/);
    await expect(page.getByText(candidateName)).toBeVisible();
    await expect(page.getByText('Terminal / tests')).toBeVisible();
    await expect(page.locator('aside').last().getByText('AI assistant')).toBeVisible();
    await expect(page.getByRole('button', { name: 'README.md' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'src/cart.ts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'src/checkout.ts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'src/payment.ts' })).toBeVisible();

    const terminalInput = page.getByRole('textbox', { name: 'Terminal command' });
    await expect(terminalInput).toBeVisible();
    await terminalInput.fill('cat src/cart.ts');
    await page.getByRole('button', { name: 'Run command' }).click();
    await expect(page.getByText('$ cat src/cart.ts')).toBeVisible();
    await expect(page.getByText('validateCart')).toBeVisible();

    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(page.getByText('Result: 0/4 passed')).toBeVisible();

    await page
      .getByRole('textbox', { name: 'Ask for a debugging plan, a review, or a specific hint...' })
      .fill('How should I approach the failing checkout tests?');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('How should I approach the failing checkout tests?')).toBeVisible();
    await expect(page.getByText('Hirewave AI', { exact: true })).toBeVisible();
    await expect(page.getByText('Tokens')).toBeVisible();

    await page.getByRole('button', { name: 'src/cart.ts' }).click();
    await replaceActiveEditor(page, PASSING_CART_TS);

    await page.getByRole('button', { name: 'src/payment.ts' }).click();
    await replaceActiveEditor(page, PASSING_PAYMENT_TS);

    await page.getByRole('button', { name: 'src/checkout.ts' }).click();
    await replaceActiveEditor(page, PASSING_CHECKOUT_TS);

    await page.getByRole('button', { name: 'Changes' }).click();
    await expect(page.getByText('3 files changed')).toBeVisible();
    await expect(page.getByText('Original', { exact: true })).toBeVisible();
    await expect(page.getByText('Current', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /src\/cart\.ts\s+\+\d+ \/ -\d+/ }).click();
    await expect(page.getByTestId('split-diff-code-cell').filter({ hasText: 'if (item.quantity === undefined)' })).toBeVisible();
    await expect(page.getByTestId('split-diff-code-cell').filter({ hasText: 'if (!Number.isInteger(item.quantity) || item.quantity <= 0)' })).toBeVisible();
    const wrappedDiffCell = page.locator('[data-testid="split-diff-code-cell"]').filter({ hasText: 'item.quantity' }).first();
    await expect(wrappedDiffCell).toHaveCSS('white-space', 'pre-wrap');
    await expect(wrappedDiffCell).toHaveCSS('overflow-wrap', 'anywhere');
    await page.getByRole('button', { name: 'Code' }).click();

    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(page.getByText('Result: 4/4 passed')).toBeVisible();

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/session\/[^/]+\/complete$/);
    await expect(page.getByRole('heading', { name: `Thank you, ${candidateName}` })).toBeVisible();

    const sessionToken = new URL(page.url()).pathname.split('/')[2];
    const session = await findSessionByToken(sessionToken);
    expect(session?.evaluationReport).toBeTruthy();

    await loginAsRecruiter(page);
    await page.goto(`/dashboard/reports/${session?.id}`);
    await expect(page.getByRole('heading', { name: `${candidateName} report` })).toBeVisible();
    await expect(page.getByText(candidateEmail)).toBeVisible();
    await expect(page.getByText('Rubric version')).toBeVisible();
    await expect(page.getByText('ai-collaboration-v1', { exact: true })).toBeVisible();
    await expect(page.getByText('Evaluator model')).toBeVisible();
    await expect(page.getByText('deterministic-evidence-ai-collaboration-v1')).toBeVisible();
    await expect(page.getByText('Dimension scores')).toBeVisible();
    await expect(page.getByText('AI transcript')).toBeVisible();
    await expect(page.getByText('Token usage')).toBeVisible();
    await expect(page.getByText('Useful responses')).toBeVisible();
    await expect(page.getByText('Commands and tests')).toBeVisible();
    await expect(page.getByText('Result: 4/4 passed')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Final diff' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change timeline' })).toBeVisible();
    await expect(page.getByText('3 files changed')).toBeVisible();
    await expect(page.getByText('4/4 tests passed')).toBeVisible();
    await expect(
      page.getByTestId('split-diff-code-cell').filter({ hasText: 'if (!Number.isInteger(item.quantity) || item.quantity <= 0)' }),
    ).toBeVisible();
    await expect(page.getByText('src/cart.ts', { exact: true })).toBeVisible();
    await expect(page.getByText('src/payment.ts', { exact: true })).toBeVisible();
    await expect(page.getByText('src/checkout.ts', { exact: true })).toBeVisible();
  });
});
