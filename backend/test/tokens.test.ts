import { describe, it, expect, beforeEach } from 'vitest';
import {
  signAuthToken,
  verifyAuthToken,
  signConfirmToken,
  verifyConfirmToken,
} from '../src/services/tokens.js';

describe('Tokens Service (JWT & One-Tap)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'super-test-secret-that-is-at-least-32-chars-long!';
  });

  it('signs and verifies auth token with correct claims', async () => {
    const claims = {
      memberId: 'm-123',
      circleId: 'c-456',
      role: 'ELDER' as const,
    };

    const token = await signAuthToken(claims);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const verified = await verifyAuthToken(token);
    expect(verified.memberId).toBe('m-123');
    expect(verified.circleId).toBe('c-456');
    expect(verified.role).toBe('ELDER');
  });

  it('signs and verifies one-tap confirmation token', async () => {
    const token = await signConfirmToken({
      doseId: 'd-789',
      circleId: 'c-456',
      action: 'take',
      expiresInSeconds: 3600,
    });

    expect(typeof token).toBe('string');

    const verified = await verifyConfirmToken(token);
    expect(verified.doseId).toBe('d-789');
    expect(verified.circleId).toBe('c-456');
    expect(verified.action).toBe('take');
  });

  it('rejects tampered token', async () => {
    const token = await signAuthToken({
      memberId: 'm-1',
      circleId: 'c-1',
      role: 'FAMILY',
    });

    const tampered = token.slice(0, -5) + 'abcde';
    await expect(verifyAuthToken(tampered)).rejects.toThrow();
  });
});
