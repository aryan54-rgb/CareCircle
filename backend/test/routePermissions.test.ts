import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../src/handlers/api.js';
import { signAuthToken } from '../src/services/tokens.js';
import type { Role } from '../src/lib/validate.js';

vi.mock('../src/db/repos/suggestionRepo.js', () => ({
  suggestionRepo: {
    create: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    listByCircle: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../src/db/repos/medRepo.js', () => ({
  medRepo: {
    create: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    listByCircle: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../src/db/repos/circleRepo.js', () => ({
  circleRepo: {
    create: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
  },
}));

vi.mock('../src/db/repos/memberRepo.js', () => ({
  memberRepo: {
    create: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn().mockResolvedValue(null),
    listByCircle: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/db/repos/notifRepo.js', () => ({
  notifRepo: {
    create: vi.fn(),
    listByCircle: vi.fn().mockResolvedValue([]),
  },
}));

describe('Route permission checks via app.request() (Task 6 & Rule 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum-length-req!';
  });

  async function createToken(role: Role) {
    return signAuthToken({
      memberId: `mem-${role.toLowerCase()}`,
      circleId: 'test-circle-perm',
      name: `Test ${role}`,
      email: `${role.toLowerCase()}@test.com`,
      role,
    });
  }

  it('rejects unauthenticated requests to protected endpoints with 401 UNAUTHORIZED', async () => {
    const res = await app.request('/meds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Aspirin' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('forbids FAMILY role from creating medications with 403 FORBIDDEN', async () => {
    const familyToken = await createToken('FAMILY');

    const res = await app.request('/meds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${familyToken}`,
      },
      body: JSON.stringify({ name: 'Aspirin' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain("Role 'FAMILY' cannot perform 'MANAGE_MEDS'");
  });

  it('forbids ELDER role from generating invites with 403 FORBIDDEN', async () => {
    const elderToken = await createToken('ELDER');

    const res = await app.request('/circle/invites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${elderToken}`,
      },
      body: JSON.stringify({ role: 'FAMILY' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('forbids FAMILY role from accessing caretaker Notification Center with 403 FORBIDDEN', async () => {
    const familyToken = await createToken('FAMILY');

    const res = await app.request('/circle/notifications', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${familyToken}`,
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('forbids FAMILY role from approving suggestions with 403 FORBIDDEN', async () => {
    const familyToken = await createToken('FAMILY');

    const res = await app.request('/suggestions/sugg-100/approve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${familyToken}`,
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('permits CARETAKER role on /meds (passes auth guard, reaches validation)', async () => {
    const caretakerToken = await createToken('CARETAKER');

    // Missing body fields -> returns 400 Bad Request, NOT 401 or 403!
    const res = await app.request('/meds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${caretakerToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('permits ELDER role on /suggestions/:id/approve (passes auth guard, reaches not found)', async () => {
    const elderToken = await createToken('ELDER');

    const res = await app.request('/suggestions/non-existent-sugg/approve', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${elderToken}`,
      },
    });

    // Reaches handler and fails with 404 NOT_FOUND, NOT 401 or 403!
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
