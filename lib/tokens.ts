import crypto from 'crypto';

export function generateToken(prefix = '') {
  const token = crypto.randomBytes(24).toString('base64url');
  return prefix ? `${prefix}_${token}` : token;
}

export function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
