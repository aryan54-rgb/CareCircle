import { Hono } from 'hono';
import { verifyConfirmToken } from '../services/tokens.js';
import { doseRepo, parseDoseId } from '../db/repos/doseRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { activityService } from '../services/activity.js';
import { escapeHtml } from '../lib/html.js';
import { Errors } from '../lib/errors.js';

const publicRoutes = new Hono();

/**
 * GET /p/confirm?t=<token>
 * Renders one-tap confirmation landing page (NEVER MUTATES STATE ON GET)
 */
publicRoutes.get('/confirm', async (c) => {
  const token = c.req.query('t');
  if (!token) {
    return c.html(renderErrorPage('Missing confirmation token.', 'Please check the link from your email.'));
  }

  try {
    const claims = await verifyConfirmToken(token);
    const { dueAt, medId } = parseDoseId(claims.doseId);
    const dose = await doseRepo.get(claims.circleId, `${dueAt}#${medId}`);

    if (!dose) {
      return c.html(renderErrorPage('Dose Not Found', 'This scheduled medication dose could not be found.'));
    }

    const safeMedName = escapeHtml(dose.medName);

    if (dose.status === 'TAKEN') {
      return c.html(
        renderSuccessPage(
          'Already Confirmed!',
          `This dose of <strong>${safeMedName}</strong> has already been recorded as TAKEN.`
        )
      );
    }

    if (dose.status === 'SKIPPED') {
      return c.html(
        renderSuccessPage(
          'Dose Skipped',
          `This dose of <strong>${safeMedName}</strong> was recorded as SKIPPED.`
        )
      );
    }

    const isTake = claims.action === 'take';
    const actionTitle = isTake ? 'Confirm You Took Your Medication' : 'Confirm Skipping Dose';
    const buttonText = isTake ? '✓ Yes, I Took It' : 'Skip This Dose';
    const buttonBg = isTake ? '#16a34a' : '#64748b';

    const clientPayload = JSON.stringify({
      token,
      buttonText,
      medName: dose.medName,
    });

    return c.html(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CareCircle - Confirm Dose</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f1f5f9;
            color: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
          }
          .card {
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            max-width: 480px;
            width: 100%;
            padding: 36px 28px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }
          .badge {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            font-size: 14px;
            font-weight: 600;
            padding: 6px 16px;
            border-radius: 999px;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 26px;
            font-weight: 800;
            margin-bottom: 12px;
            color: #1e293b;
          }
          .med-name {
            font-size: 32px;
            font-weight: 800;
            color: #2563eb;
            margin: 16px 0;
            word-break: break-word;
          }
          p {
            font-size: 18px;
            line-height: 1.5;
            color: #475569;
            margin-bottom: 28px;
          }
          .btn {
            display: block;
            width: 100%;
            background: ${buttonBg};
            color: #ffffff;
            font-size: 22px;
            font-weight: 700;
            padding: 18px 24px;
            border: none;
            border-radius: 14px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(0,0,0,0.15);
            transition: transform 0.1s ease, filter 0.1s ease;
          }
          .btn:active {
            transform: scale(0.98);
            filter: brightness(0.95);
          }
          .status {
            margin-top: 20px;
            font-size: 16px;
            display: none;
          }
          .footer {
            margin-top: 30px;
            font-size: 13px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="card" id="main-card">
          <div class="badge">One-Tap Confirmation</div>
          <h1>${escapeHtml(actionTitle)}</h1>
          <div class="med-name">${safeMedName}</div>
          <p>Tap the button below to update your care circle immediately.</p>
          <button class="btn" id="confirm-btn">
            ${escapeHtml(buttonText)}
          </button>
          <div class="status" id="status-msg"></div>
          <div class="footer">
            CareCircle helps organise routines. Always follow your doctor's instructions.
          </div>
        </div>

        <script type="application/json" id="client-payload">${clientPayload}</script>

        <script>
          (function() {
            var rawData = document.getElementById('client-payload').textContent;
            var data = JSON.parse(rawData || '{}');
            var btn = document.getElementById('confirm-btn');
            var status = document.getElementById('status-msg');

            btn.addEventListener('click', async function() {
              btn.disabled = true;
              btn.style.opacity = '0.7';
              btn.textContent = 'Updating...';

              try {
                var res = await fetch('/p/confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: data.token })
                });
                var json = await res.json();
                if (res.ok) {
                  var mainCard = document.getElementById('main-card');
                  mainCard.innerHTML =
                    '<div style="font-size: 64px; color: #16a34a; margin-bottom: 16px;">✓</div>' +
                    '<h1 style="color: #16a34a;">Recorded Successfully!</h1>' +
                    '<div class="med-name" id="success-med"></div>' +
                    '<p style="font-size: 20px; color: #334155;">Your care circle has been notified.</p>' +
                    '<div class="footer">You may now close this browser tab.</div>';
                  document.getElementById('success-med').textContent = data.medName;
                } else {
                  btn.disabled = false;
                  btn.style.opacity = '1';
                  btn.textContent = data.buttonText;
                  status.style.display = 'block';
                  status.style.color = '#dc2626';
                  status.textContent = (json.error && json.error.message) || 'Failed to record. Please try again.';
                }
              } catch (err) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.textContent = data.buttonText;
                status.style.display = 'block';
                status.style.color = '#dc2626';
                status.textContent = 'Network error. Please try again.';
              }
            });
          })();
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    return c.html(renderErrorPage('Link Expired or Invalid', 'This one-tap confirmation link has expired or is invalid.'));
  }
});

/**
 * POST /p/confirm
 * Mutates state: marks dose taken or skipped using the signed token
 */
publicRoutes.post('/confirm', async (c) => {
  const body = await c.req.json();
  const token = body.token;
  if (!token) throw Errors.badRequest('Missing token');

  const claims = await verifyConfirmToken(token);
  const { dueAt, medId } = parseDoseId(claims.doseId);

  const dose = await doseRepo.get(claims.circleId, `${dueAt}#${medId}`);
  if (!dose) {
    throw Errors.notFound('Dose event not found');
  }

  if (dose.status === 'TAKEN' || dose.status === 'SKIPPED') {
    return c.json({
      success: true,
      alreadyRecorded: true,
      status: dose.status,
      message: `Dose was already marked as ${dose.status}`,
    });
  }

  let updatedDose;
  if (claims.action === 'take') {
    updatedDose = await doseRepo.markTaken(
      claims.circleId,
      dueAt,
      medId,
      'elder-link',
      'Elder (One-Tap Email)'
    );
    await medRepo.decrementPillCount(claims.circleId, medId);
    await activityService.log({
      circleId: claims.circleId,
      actorId: 'elder-link',
      actorName: 'Elder',
      action: 'DOSE_TAKEN',
      summary: `Elder confirmed taking ${dose.medName} via one-tap email link.`,
    });
  } else {
    updatedDose = await doseRepo.markSkipped(
      claims.circleId,
      dueAt,
      medId,
      'elder-link',
      'Elder (One-Tap Email)'
    );
    await activityService.log({
      circleId: claims.circleId,
      actorId: 'elder-link',
      actorName: 'Elder',
      action: 'DOSE_SKIPPED',
      summary: `Elder skipped ${dose.medName} via email link.`,
    });
  }

  return c.json({
    success: true,
    status: claims.action === 'take' ? 'TAKEN' : 'SKIPPED',
    dose: updatedDose,
    message: `Dose of ${dose.medName} recorded successfully!`,
  });
});

function renderSuccessPage(title: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: -apple-system, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
        .card { background: #fff; padding: 36px 28px; border-radius: 16px; max-width: 440px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        h1 { color: #16a34a; font-size: 24px; margin-bottom: 12px; }
        p { font-size: 17px; color: #475569; line-height: 1.5; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size: 56px; color: #16a34a; margin-bottom: 10px;">✓</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${message}</p>
        <p style="font-size: 13px; color: #94a3b8;">You can safely close this page.</p>
      </div>
    </body>
    </html>
  `;
}

function renderErrorPage(title: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: -apple-system, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
        .card { background: #fff; padding: 36px 28px; border-radius: 16px; max-width: 440px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        h1 { color: #dc2626; font-size: 24px; margin-bottom: 12px; }
        p { font-size: 17px; color: #475569; line-height: 1.5; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div style="font-size: 56px; color: #dc2626; margin-bottom: 10px;">!</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <p style="font-size: 13px; color: #94a3b8;">CareCircle Platform</p>
      </div>
    </body>
    </html>
  `;
}

export { publicRoutes };
