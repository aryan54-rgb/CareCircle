import { SignJWT, jwtVerify } from 'jose';
import { Role } from '../lib/validate.js';
import { config } from '../lib/config.js';

export interface AuthClaims {
  memberId: string;
  circleId: string;
  role: Role;
}

export interface ConfirmTokenClaims {
  doseId: string;
  circleId: string;
  action: 'take' | 'skip';
  exp?: number;
}

function getSecretKey(secretString: string): Uint8Array {
  return new TextEncoder().encode(secretString);
}

/**
 * Signs an authentication JWT valid for 7 days
 */
export async function signAuthToken(claims: AuthClaims): Promise<string> {
  const secret = await config.getJwtSecret();
  const key = getSecretKey(secret);

  return new SignJWT({
    memberId: claims.memberId,
    circleId: claims.circleId,
    role: claims.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

/**
 * Verifies an authentication JWT
 */
export async function verifyAuthToken(token: string): Promise<AuthClaims> {
  const secret = await config.getJwtSecret();
  const key = getSecretKey(secret);

  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'],
  });

  return {
    memberId: payload.memberId as string,
    circleId: payload.circleId as string,
    role: payload.role as Role,
  };
}

/**
 * Signs a single-use one-tap confirmation token from email links
 */
export async function signConfirmToken(claims: {
  doseId: string;
  circleId: string;
  action: 'take' | 'skip';
  expiresInSeconds?: number;
}): Promise<string> {
  const secret = await config.getJwtSecret();
  const key = getSecretKey(secret);
  const expiration = claims.expiresInSeconds || 6 * 3600; // default 6 hours

  return new SignJWT({
    doseId: claims.doseId,
    circleId: claims.circleId,
    action: claims.action,
    purpose: 'one-tap-confirm',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiration}s`)
    .sign(key);
}

/**
 * Verifies a single-use one-tap confirmation token
 */
export async function verifyConfirmToken(token: string): Promise<ConfirmTokenClaims> {
  const secret = await config.getJwtSecret();
  const key = getSecretKey(secret);

  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'],
  });

  if (payload.purpose !== 'one-tap-confirm') {
    throw new Error('Invalid token purpose');
  }

  return {
    doseId: payload.doseId as string,
    circleId: payload.circleId as string,
    action: payload.action as 'take' | 'skip',
    exp: payload.exp,
  };
}
