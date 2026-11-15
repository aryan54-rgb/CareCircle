import { describe, it, expect } from 'vitest';
import {
  nextAppointmentStage,
  AppointmentLike,
  AppointmentSettings,
} from '../src/domain/appointmentStateMachine.js';

describe('Appointment State Machine (Spec Section 6.4)', () => {
  const baseAppt: AppointmentLike = {
    startsAt: '2026-11-20T10:00:00.000Z',
    stage: 'SCHEDULED',
    doctor: 'Dr. Ramesh Sharma (Cardiologist)',
    place: 'Max Hospital, Saket',
  };

  const defaultSettings: AppointmentSettings = {
    appointmentReminders: [1440, 120], // 24 hours, 2 hours
  };

  it('stays in SCHEDULED before 24-hour reminder threshold', () => {
    // 25 hours before startsAt
    const now = new Date('2026-11-19T09:00:00.000Z');
    const result = nextAppointmentStage(baseAppt, defaultSettings, now);

    expect(result.nextStage).toBeUndefined();
    expect(result.nextActionAt).toBe('2026-11-19T10:00:00.000Z'); // 24h before
    expect(result.isTerminal).toBe(false);
    expect(result.emails).toHaveLength(0);
  });

  it('transitions from SCHEDULED to REMIND_24H when within 24 hours', () => {
    // exactly 24 hours before startsAt
    const now = new Date('2026-11-19T10:00:00.000Z');
    const result = nextAppointmentStage(baseAppt, defaultSettings, now);

    expect(result.nextStage).toBe('REMIND_24H');
    expect(result.nextActionAt).toBe('2026-11-20T08:00:00.000Z'); // 2h before
    expect(result.isTerminal).toBe(false);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].stage).toBe('REMIND_24H');
    expect(result.emails[0].recipientRoles).toEqual(['ELDER', 'CARETAKER']);
    expect(result.emails[0].subject).toContain('Dr. Ramesh Sharma');
  });

  it('transitions from REMIND_24H to REMIND_2H when within 2 hours', () => {
    const appt: AppointmentLike = { ...baseAppt, stage: 'REMIND_24H' };
    // 1 hour 50 minutes before startsAt
    const now = new Date('2026-11-20T08:10:00.000Z');
    const result = nextAppointmentStage(appt, defaultSettings, now);

    expect(result.nextStage).toBe('REMIND_2H');
    expect(result.nextActionAt).toBe('2026-11-20T10:00:00.000Z'); // at startsAt
    expect(result.isTerminal).toBe(false);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].stage).toBe('REMIND_2H');
  });

  it('transitions directly from SCHEDULED to REMIND_2H if evaluated within 2-hour window', () => {
    // 90 minutes before startsAt
    const now = new Date('2026-11-20T08:30:00.000Z');
    const result = nextAppointmentStage(baseAppt, defaultSettings, now);

    expect(result.nextStage).toBe('REMIND_2H');
    expect(result.emails[0].stage).toBe('REMIND_2H');
  });

  it('transitions to DONE once the appointment time has arrived or passed', () => {
    const appt: AppointmentLike = { ...baseAppt, stage: 'REMIND_2H' };
    // At startsAt
    const now = new Date('2026-11-20T10:00:00.000Z');
    const result = nextAppointmentStage(appt, defaultSettings, now);

    expect(result.nextStage).toBe('DONE');
    expect(result.isTerminal).toBe(true);
    expect(result.nextActionAt).toBeUndefined();
    expect(result.emails).toHaveLength(0);
  });

  it('respects custom appointmentReminders setting from circle', () => {
    const customSettings: AppointmentSettings = {
      appointmentReminders: [60, 10], // 60 mins before, 10 mins before
    };
    // 45 minutes before
    const now = new Date('2026-11-20T09:15:00.000Z');
    const result = nextAppointmentStage(baseAppt, customSettings, now);

    expect(result.nextStage).toBe('REMIND_24H');
    expect(result.nextActionAt).toBe('2026-11-20T09:50:00.000Z'); // 10 mins before
  });
});
