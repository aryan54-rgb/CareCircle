import crypto from 'crypto';
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { circleRepo, DEFAULT_CIRCLE_SETTINGS } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { authRepo } from '../db/repos/authRepo.js';
import { activityService } from '../services/activity.js';
import { signAuthToken } from '../services/tokens.js';
import { createCircleSchema, joinCircleSchema, loginSchema } from '../lib/validate.js';
import { Errors } from '../lib/errors.js';

const authRoutes = new Hono();

/**
 * POST /auth/circles
 * Creates circle + initial caretaker (circle owner). Returns JWT token.
 */
authRoutes.post('/circles', async (c) => {
  const body = await c.req.json();
  const parsed = createCircleSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { name, elderName, caretakerName, caretakerEmail, caretakerPasscode, timezone } =
    parsed.data;
  const normalizedEmail = caretakerEmail.toLowerCase().trim();

  // Check if email already registered to a circle
  const existingLookup = await authRepo.getLoginLookup(normalizedEmail);
  if (existingLookup) {
    throw Errors.conflict('Email is already registered in a care circle.');
  }

  const circleId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  // Hash passcode
  const passcodeHash = await bcrypt.hash(caretakerPasscode, 10);

  // 1. Create Circle
  await circleRepo.create({
    circleId,
    name,
    elderName,
    timezone,
    settings: {
      ...DEFAULT_CIRCLE_SETTINGS,
      timezone,
    },
  });

  // 2. Create Caretaker Member (Owner)
  const member = await memberRepo.create({
    circleId,
    memberId,
    name: caretakerName,
    email: normalizedEmail,
    role: 'CARETAKER',
    passcodeHash,
  });

  // 3. Set Login Lookup
  await authRepo.setLoginLookup(normalizedEmail, circleId, memberId);

  // 4. Log initial activity
  await activityService.log({
    circleId,
    actorId: memberId,
    actorName: caretakerName,
    action: 'CREATE_CIRCLE',
    summary: `Circle "${name}" created for ${elderName}.`,
  });

  // 5. Generate JWT
  const token = await signAuthToken({
    memberId,
    circleId,
    role: 'CARETAKER',
  });

  return c.json({
    token,
    circleId,
    member: {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      role: member.role,
    },
  });
});

/**
 * POST /auth/join
 * Join an existing circle using an invite code. Role is determined by the invite.
 */
authRoutes.post('/join', async (c) => {
  const body = await c.req.json();
  const parsed = joinCircleSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { inviteCode, name, email, passcode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Rate limiting on join attempts to prevent brute-force
  const attempts = await authRepo.getFailedAttempts(normalizedEmail);
  if (attempts && attempts.count >= 5) {
    throw Errors.locked();
  }

  // 2. Verify Invite Code
  const invite = await authRepo.getInvite(inviteCode);
  if (!invite) {
    const count = await authRepo.recordFailedAttempt(normalizedEmail);
    if (count >= 5) throw Errors.locked();
    throw Errors.notFound('Invite code is invalid or has expired.');
  }

  if (invite.usedAt) {
    await authRepo.recordFailedAttempt(normalizedEmail);
    throw Errors.badRequest('Invite code has already been used.');
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    await authRepo.recordFailedAttempt(normalizedEmail);
    throw Errors.badRequest('Invite code has expired.');
  }

  // 3. Check if email already registered
  const existingLookup = await authRepo.getLoginLookup(normalizedEmail);
  if (existingLookup) {
    throw Errors.conflict('Email is already registered in a care circle.');
  }

  // 4. Create member with the invited role
  const memberId = crypto.randomUUID();
  const passcodeHash = await bcrypt.hash(passcode, 10);

  const member = await memberRepo.create({
    circleId: invite.circleId,
    memberId,
    name,
    email: normalizedEmail,
    role: invite.role,
    passcodeHash,
  });

  // 5. Mark invite as used & clear failed attempts
  await authRepo.markInviteUsed(inviteCode, memberId);
  await authRepo.clearFailedAttempts(normalizedEmail);

  // 5. Set Login Lookup
  await authRepo.setLoginLookup(normalizedEmail, invite.circleId, memberId);

  // 6. Log activity
  await activityService.log({
    circleId: invite.circleId,
    actorId: memberId,
    actorName: name,
    action: 'JOIN_CIRCLE',
    summary: `${name} joined as ${invite.role}.`,
  });

  // 7. Generate JWT
  const token = await signAuthToken({
    memberId,
    circleId: invite.circleId,
    role: invite.role,
  });

  return c.json({
    token,
    circleId: invite.circleId,
    member: {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      role: member.role,
    },
  });
});

/**
 * POST /auth/login
 * Log in using email and passcode. Lockout after 5 failed attempts within 15 min.
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { email, passcode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check lockout attempts
  const attempts = await authRepo.getFailedAttempts(normalizedEmail);
  if (attempts && attempts.count >= 5) {
    throw Errors.locked();
  }

  // 2. Resolve email to circle & member
  const lookup = await authRepo.getLoginLookup(normalizedEmail);
  if (!lookup) {
    // Record failure to avoid timing attacks
    await authRepo.recordFailedAttempt(normalizedEmail);
    throw Errors.unauthorized('Invalid email or passcode.');
  }

  // 3. Fetch member record
  const member = await memberRepo.get(lookup.circleId, lookup.memberId);
  if (!member) {
    await authRepo.recordFailedAttempt(normalizedEmail);
    throw Errors.unauthorized('Invalid email or passcode.');
  }

  // 4. Check passcode hash
  const isValid = await bcrypt.compare(passcode, member.passcodeHash);
  if (!isValid) {
    const count = await authRepo.recordFailedAttempt(normalizedEmail);
    if (count >= 5) {
      throw Errors.locked();
    }
    const remaining = 5 - count;
    throw Errors.unauthorized(`Invalid email or passcode. ${remaining} attempt(s) remaining.`);
  }

  // 5. Success -> clear failed attempts
  await authRepo.clearFailedAttempts(normalizedEmail);

  // 6. Generate JWT
  const token = await signAuthToken({
    memberId: member.memberId,
    circleId: member.circleId,
    role: member.role,
  });

  return c.json({
    token,
    circleId: member.circleId,
    member: {
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      role: member.role,
    },
  });
});

export { authRoutes };
