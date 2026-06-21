import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { registerUser } from '../../lib/auth/register';

const email = () => `onb-${crypto.randomBytes(6).toString('hex')}@test.local`;

test.describe('recruiter onboarding', () => {
  test('recruiter signup creates an owner workspace', async () => {
    const user = await registerUser({ name: 'Rae', email: email(), password: 'password123', role: 'recruiter', company: 'Acme Inc' });
    expect(user.role).toBe('recruiter');

    const membership = await db.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });
    expect(membership?.role).toBe('owner');
    expect(membership?.workspace.name).toBe('Acme Inc');
    expect(membership?.workspace.slug).toMatch(/^acme-inc-[0-9a-f]{6}$/);
  });

  test('recruiter without a company name gets a personal workspace', async () => {
    const user = await registerUser({ name: 'Sam Lee', email: email(), password: 'password123', role: 'recruiter' });
    const membership = await db.workspaceMember.findFirst({ where: { userId: user.id }, include: { workspace: true } });
    expect(membership?.workspace.name).toBe("Sam Lee's Workspace");
  });

  test('student signup creates no workspace', async () => {
    const user = await registerUser({ name: 'Stu', email: email(), password: 'password123', role: 'student' });
    expect(user.role).toBe('student');
    const membership = await db.workspaceMember.findFirst({ where: { userId: user.id } });
    expect(membership).toBeNull();
  });

  test('two companies with the same name get distinct workspace slugs', async () => {
    const a = await registerUser({ name: 'A', email: email(), password: 'password123', role: 'recruiter', company: 'Dupe Co' });
    const b = await registerUser({ name: 'B', email: email(), password: 'password123', role: 'recruiter', company: 'Dupe Co' });
    const wa = await db.workspaceMember.findFirst({ where: { userId: a.id }, include: { workspace: true } });
    const wb = await db.workspaceMember.findFirst({ where: { userId: b.id }, include: { workspace: true } });
    expect(wa?.workspace.slug).not.toBe(wb?.workspace.slug);
  });
});
