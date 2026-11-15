import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import nodemailer from 'nodemailer';
import { config } from '../lib/config.js';
import { escapeHtml } from '../lib/html.js';
import { logger } from '../lib/logger.js';

export interface SendMailOptions {
  to: string[];
  subject: string;
  stage: string;
  medName?: string;
  takeUrl?: string;
  skipUrl?: string;
  // Appointment fields
  doctor?: string;
  place?: string;
  startsAt?: string;
  notes?: string;
  // Digest fields
  digestElderName?: string;
  digestSummary?: string;
  digestAdherenceRate?: number;
  digestStats?: { taken: number; skipped: number; missed: number };
}

export interface MailerService {
  send(options: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

/**
 * Builds minimal, accessible, XSS-safe HTML email containing one-tap action links or appointment reminders
 * Note: Minimal personal health info included per Section 9
 */
function buildEmailHtml(options: SendMailOptions): string {
  const { stage, takeUrl, skipUrl } = options;
  const safeMedName = escapeHtml(options.medName);
  const safeDoctor = escapeHtml(options.doctor);
  const safePlace = escapeHtml(options.place);
  const safeNotes = escapeHtml(options.notes);
  const safeElderName = escapeHtml(options.digestElderName);
  const safeDigestSummary = escapeHtml(options.digestSummary);

  let headerColor = '#2563eb'; // blue
  let headline = `Medication Reminder: ${safeMedName}`;
  let subtext = `It is time to take your dose of <strong>${safeMedName}</strong>.`;
  let extraContent = '';

  // Appointment Email Template
  if (options.doctor) {
    const is2H = stage === 'REMIND_2H';
    headerColor = is2H ? '#ea580c' : '#2563eb';
    headline = is2H
      ? `Appointment in 2 Hours: Dr. ${safeDoctor}`
      : `Upcoming Doctor Appointment Tomorrow: Dr. ${safeDoctor}`;
    const timeLabel = is2H ? 'in approximately 2 hours' : 'tomorrow';
    subtext = `Reminder: scheduled medical visit with <strong>Dr. ${safeDoctor}</strong> ${timeLabel} at <strong>${safePlace || 'Designated Clinic'}</strong>.`;
    if (safeNotes) {
      extraContent = `
        <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Notes:</strong> ${safeNotes}</p>
        </div>
      `;
    }
  } else if (options.digestSummary) {
    // Weekly Digest Template
    headerColor = '#1e40af';
    headline = `Weekly Adherence Digest: ${safeElderName}`;
    subtext = safeDigestSummary;
    const stats = options.digestStats;
    if (stats) {
      extraContent = `
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <div style="font-size: 28px; font-weight: 800; color: #16a34a; text-align: center;">
            ${options.digestAdherenceRate ?? 100}%
          </div>
          <div style="text-align: center; font-size: 13px; color: #64748b; margin-bottom: 12px;">7-Day Adherence Rate</div>
          <table style="width: 100%; text-align: center; font-size: 14px;">
            <tr>
              <td style="color: #16a34a;"><strong>${stats.taken}</strong> Taken</td>
              <td style="color: #dc2626;"><strong>${stats.missed}</strong> Missed</td>
              <td style="color: #64748b;"><strong>${stats.skipped}</strong> Skipped</td>
            </tr>
          </table>
        </div>
      `;
    }
  } else {
    // Medication Reminders & Escalations
    if (stage === 'ESCALATED_1') {
      headerColor = '#d97706'; // amber
      headline = `Escalation Notice: ${safeMedName}`;
      subtext = `A scheduled dose of <strong>${safeMedName}</strong> has not been confirmed by the elder. As a designated caretaker, please verify.`;
    } else if (stage === 'ESCALATED_2') {
      headerColor = '#ea580c'; // orange
      headline = `Family Alert: ${safeMedName}`;
      subtext = `A scheduled dose of <strong>${safeMedName}</strong> remains unconfirmed. Care circle members and family are being notified.`;
    } else if (stage === 'MISSED') {
      headerColor = '#dc2626'; // red
      headline = `Dose Missed: ${safeMedName}`;
      subtext = `The scheduled dose of <strong>${safeMedName}</strong> has exceeded the escalation window and is marked as MISSED for adherence tracking.`;
    }
  }

  const actionButtons = takeUrl
    ? `
    <div style="margin: 30px 0; text-align: center;">
      <a href="${takeUrl}" style="background-color: #16a34a; color: #ffffff; padding: 16px 32px; font-size: 20px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; margin-right: 15px; min-width: 140px;">
        ✓ I Took It
      </a>
      ${
        skipUrl
          ? `<a href="${skipUrl}" style="background-color: #64748b; color: #ffffff; padding: 16px 24px; font-size: 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
        Skip Dose
      </a>`
          : ''
      }
    </div>
    <p style="font-size: 13px; color: #64748b; text-align: center;">
      Tapping the button opens a one-click confirmation screen. No password needed.
    </p>
  `
    : '';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="background-color: ${headerColor}; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700;">CareCircle</h1>
        <p style="margin: 6px 0 0 0; font-size: 15px; opacity: 0.95;">Elderly Care & Medication Management</p>
      </div>
      <div style="padding: 28px 24px;">
        <h2 style="font-size: 20px; color: #0f172a; margin-top: 0;">${headline}</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #334155;">${subtext}</p>
        ${extraContent}
        ${actionButtons}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">
          CareCircle helps organise routines. It is not medical advice. Always follow your doctor's instructions.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Amazon SES v2 Mailer implementation
 */
class SESMailer implements MailerService {
  private client: SESv2Client;

  constructor() {
    this.client = new SESv2Client({ region: config.awsRegion });
  }

  async send(options: SendMailOptions) {
    const html = buildEmailHtml(options);

    try {
      const res = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: config.sesFrom,
          Destination: {
            ToAddresses: options.to,
          },
          Content: {
            Simple: {
              Subject: {
                Data: options.subject,
                Charset: 'UTF-8',
              },
              Body: {
                Html: {
                  Data: html,
                  Charset: 'UTF-8',
                },
              },
            },
          },
        })
      );
      logger.info(`[SES] Email sent to ${options.to.join(', ')}: ${res.MessageId}`);
      return { success: true, messageId: res.MessageId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[SES] Send error for ${options.to.join(', ')}: ${msg}. (May need verification in sandbox)`);
      return { success: false, error: msg };
    }
  }
}

/**
 * SMTP Mailer implementation (Nodemailer fallback)
 */
class SMTPMailer implements MailerService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async send(options: SendMailOptions) {
    if (!this.transporter) {
      logger.warn('[SMTP] SMTP transport not configured, logging email instead.');
      return new LogMailer().send(options);
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.sesFrom,
        to: options.to,
        subject: options.subject,
        html: buildEmailHtml(options),
      });
      logger.info(`[SMTP] Email sent to ${options.to.join(', ')}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[SMTP] Send error:', msg);
      return { success: false, error: msg };
    }
  }
}

/**
 * Mock / Log Mailer for local dev and testing
 */
class LogMailer implements MailerService {
  async send(options: SendMailOptions) {
    logger.info(`\n📧 [EMAIL MOCK] -----------------------------`);
    logger.info(`TO: ${options.to.join(', ')}`);
    logger.info(`SUBJECT: ${options.subject}`);
    if (options.medName) logger.info(`MEDICATION: ${options.medName} (${options.stage})`);
    if (options.doctor) logger.info(`APPOINTMENT: Dr. ${options.doctor} at ${options.place} (${options.stage})`);
    if (options.digestSummary) logger.info(`DIGEST: ${options.digestSummary}`);
    if (options.takeUrl) logger.info(`ONE-TAP TAKE: ${options.takeUrl}`);
    if (options.skipUrl) logger.info(`ONE-TAP SKIP: ${options.skipUrl}`);
    logger.info(`--------------------------------------------\n`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}

function createMailer(): MailerService {
  if (config.mailDriver === 'smtp') {
    return new SMTPMailer();
  }
  if (config.mailDriver === 'log') {
    return new LogMailer();
  }
  return new SESMailer();
}

export const mailer = createMailer();
