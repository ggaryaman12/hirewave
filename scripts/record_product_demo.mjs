import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.DEMO_PORT || 4310);
const baseURL = `http://127.0.0.1:${port}`;
const outputDir = path.join(root, 'output', 'video');
const rawDir = path.join(outputDir, 'raw');
const finalWebm = path.join(outputDir, 'hirewave-end-to-end-demo.webm');
const finalMp4 = path.join(outputDir, 'hirewave-end-to-end-demo.mp4');

const PASSING_CART_TS = `export type CartItem = {
  sku: string;
  quantity: number;
  priceCents: number;
};

export function validateCart(items: CartItem[]) {
  if (items.length === 0) {
    throw new Error('Cart is empty');
  }

  for (const item of items) {
    if (!item.sku) {
      throw new Error('Missing SKU');
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Invalid quantity');
    }
  }
}

export function totalCents(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
}
`;

const PASSING_PAYMENT_TS = `type ChargeInput = {
  amountCents: number;
  customerId: string;
  idempotencyKey: string;
};

export async function chargeCard(input: ChargeInput) {
  if (input.amountCents <= 0) {
    throw new Error('Invalid charge amount');
  }

  return {
    id: 'pay_demo_123',
    status: 'succeeded',
    idempotencyKey: input.idempotencyKey,
  };
}
`;

const PASSING_CHECKOUT_TS = `import { CartItem, totalCents, validateCart } from './cart';
import { chargeCard } from './payment';

type CheckoutInput = {
  customerId: string;
  items: CartItem[];
};

async function reserveInventory(items: CartItem[]) {
  return {
    reservationId: 'res_demo_123',
    items,
  };
}

async function createOrder(input: CheckoutInput, paymentId: string) {
  return {
    id: 'ord_demo_123',
    customerId: input.customerId,
    paymentId,
    items: input.items,
  };
}

async function rollbackInventory(reservationId: string) {
  return { reservationId, rolledBack: true };
}

export async function checkout(input: CheckoutInput) {
  validateCart(input.items);

  const reservation = await reserveInventory(input.items);
  const amountCents = totalCents(input.items);
  const idempotencyKey = [
    input.customerId,
    ...input.items.map((item) => item.sku + ':' + item.quantity),
  ].join('|');

  let payment;
  try {
    payment = await chargeCard({
      amountCents,
      customerId: input.customerId,
      idempotencyKey,
    });
  } catch (error) {
    await rollbackInventory(reservation.reservationId);
    throw error;
  }

  return createOrder(input, payment.id);
}
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, AI_PROVIDER: 'deterministic', ...options.env },
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  return result;
}

function tryRun(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, AI_PROVIDER: 'deterministic' },
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0;
}

async function waitForServer(server) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next dev server exited early with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(baseURL);
      if (response.status < 500) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('Timed out waiting for Next dev server');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function replaceActiveEditor(page, content) {
  await page.locator('textarea').first().fill(content);
  await page.waitForTimeout(1200);
}

async function shortPause(page, ms = 450) {
  await page.waitForTimeout(ms);
}

async function recordFlow() {
  await fs.rm(rawDir, { recursive: true, force: true });
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  run('npm', ['run', 'db:seed']);

  const server = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '-p', String(port)], {
    cwd: root,
    env: { ...process.env, AI_PROVIDER: 'deterministic', FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let browser;
  let context;
  let page;

  try {
    await waitForServer(server);

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: rawDir,
        size: { width: 1280, height: 720 },
      },
    });
    page = await context.newPage();

    const candidateName = 'Aarya Demo Candidate';
    const candidateEmail = `demo.${Date.now()}@example.com`;

    await page.goto('/api/auth/demo?next=/dashboard');
    await page.getByRole('heading', { name: /Hiring dashboard|Dashboard/i }).waitFor({ timeout: 20_000 }).catch(() => undefined);
    await shortPause(page, 700);

    await page.goto('/invite/demo-invite');
    await page.getByRole('textbox', { name: 'Full name' }).fill(candidateName);
    await page.getByRole('textbox', { name: 'Email' }).fill(candidateEmail);
    await shortPause(page, 350);
    await page.getByRole('button', { name: 'Start assessment' }).click();
    await page.waitForURL(/\/session\/[^/]+$/);
    await shortPause(page, 700);

    const terminalInput = page.getByRole('textbox', { name: 'Terminal command' });
    await terminalInput.fill('cat src/cart.ts');
    await page.getByRole('button', { name: 'Run command' }).click();
    await page.getByText('$ cat src/cart.ts').waitFor();
    await shortPause(page, 500);

    await page.getByRole('button', { name: 'Run tests' }).click();
    await page.getByText('Result: 0/4 passed').waitFor();
    await shortPause(page, 650);

    await page
      .getByRole('textbox', { name: 'Ask for a debugging plan, a review, or a specific hint...' })
      .fill('How should I approach the failing checkout tests?');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByText('Hirewave AI', { exact: true }).waitFor();
    await shortPause(page, 700);

    await page.getByRole('button', { name: 'src/cart.ts' }).click();
    await replaceActiveEditor(page, PASSING_CART_TS);
    await page.getByRole('button', { name: 'src/payment.ts' }).click();
    await replaceActiveEditor(page, PASSING_PAYMENT_TS);
    await page.getByRole('button', { name: 'src/checkout.ts' }).click();
    await replaceActiveEditor(page, PASSING_CHECKOUT_TS);

    await page.getByRole('button', { name: 'Changes' }).click();
    await page.getByText('3 files changed').waitFor();
    await shortPause(page, 800);

    await page.getByRole('button', { name: 'Code' }).click();
    await page.getByRole('button', { name: 'Run tests' }).click();
    await page.getByText('Result: 4/4 passed').waitFor();
    await shortPause(page, 800);

    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForURL(/\/session\/[^/]+\/complete$/);
    await page.getByRole('heading', { name: `Thank you, ${candidateName}` }).waitFor();
    await shortPause(page, 650);

    const sessionToken = new URL(page.url()).pathname.split('/')[2];
    const prisma = new PrismaClient();
    const session = await prisma.candidateSession.findUnique({
      where: { sessionTokenHash: tokenHash(sessionToken) },
    });
    await prisma.$disconnect();
    if (!session) throw new Error('Recorded session was not found');

    await page.goto(`/dashboard/reports/${session.id}`);
    await page.getByRole('heading', { name: `${candidateName} report` }).waitFor();
    await shortPause(page, 900);
    await page.mouse.wheel(0, 760);
    await shortPause(page, 700);
    await page.mouse.wheel(0, 950);
    await shortPause(page, 900);

    const video = page.video();
    await context.close();
    context = null;
    await browser.close();
    browser = null;

    const rawPath = await video.path();
    await fs.copyFile(rawPath, finalWebm);

    let mp4 = null;
    const fullFfmpegPath = process.env.FFMPEG_PATH;
    if (fullFfmpegPath && await fs.stat(fullFfmpegPath).then(() => true).catch(() => false)) {
      const converted = tryRun(fullFfmpegPath, [
        '-y',
        '-i',
        finalWebm,
        '-t',
        '30',
        '-vf',
        'scale=1280:720,fps=30,format=yuv420p',
        '-movflags',
        '+faststart',
        finalMp4,
      ]);
      if (converted) mp4 = finalMp4;
    }

    console.log(JSON.stringify({ webm: finalWebm, mp4 }, null, 2));
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit').catch(() => undefined);
    }
  }
}

recordFlow().catch((error) => {
  console.error(error);
  process.exit(1);
});
