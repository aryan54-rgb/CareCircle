import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../src/handlers/api.js';
import { doseRepo } from '../src/db/repos/doseRepo.js';
import { signConfirmToken } from '../src/services/tokens.js';
import { escapeHtml } from '../src/lib/html.js';

describe('Public one-tap confirm page escaping medName (Task 6 & Rule 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-32-chars-minimum-length-req!';
  });

  it('escapeHtml escapes dangerous HTML characters properly', () => {
    const malicious = '<script>alert("XSS")</script> & \'injection\'';
    const safe = escapeHtml(malicious);
    expect(safe).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt; &amp; &#039;injection&#039;');
    expect(safe).not.toContain('<script>');
  });

  it('escapes malicious medName in GET /p/confirm landing page to prevent HTML injection', async () => {
    const xssMedName = '<img src=x onerror=alert(1)> & "Amoxicillin"';
    const dueAt = '2026-11-15T09:00:00.000Z';
    const medId = 'med-xss-1';
    const circleId = 'circle-sec-test';
    const doseId = `${dueAt}#${medId}`;

    const token = await signConfirmToken({
      doseId,
      circleId,
      action: 'take',
    });

    vi.spyOn(doseRepo, 'get').mockResolvedValue({
      id: doseId,
      circleId,
      medId,
      medName: xssMedName,
      dueAt,
      status: 'REMINDED',
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T08:50:00.000Z',
    });

    const res = await app.request(`/p/confirm?t=${token}`);
    expect(res.status).toBe(200);

    const html = await res.text();

    // Verify raw unescaped HTML tag is NOT in the response body
    expect(html).not.toContain('<img src=x onerror=alert(1)>');

    // Verify escaped entity appears
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Amoxicillin&quot;');
    expect(html).toContain('<div class="med-name">');
  });

  it('escapes medName when dose has already been taken', async () => {
    const xssMedName = '<script>evil()</script>';
    const dueAt = '2026-11-15T09:00:00.000Z';
    const medId = 'med-xss-2';
    const circleId = 'circle-sec-test';
    const doseId = `${dueAt}#${medId}`;

    const token = await signConfirmToken({
      doseId,
      circleId,
      action: 'take',
    });

    vi.spyOn(doseRepo, 'get').mockResolvedValue({
      id: doseId,
      circleId,
      medId,
      medName: xssMedName,
      dueAt,
      status: 'TAKEN',
      takenAt: '2026-11-15T09:01:00.000Z',
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T09:01:00.000Z',
    });

    const res = await app.request(`/p/confirm?t=${token}`);
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).not.toContain('<script>evil()</script>');
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(html).toContain('already been recorded as TAKEN');
  });
});
