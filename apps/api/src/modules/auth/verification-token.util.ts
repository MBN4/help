import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedToken {
  raw: string;
  hash: string;
}

export function generateVerificationToken(): GeneratedToken {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
