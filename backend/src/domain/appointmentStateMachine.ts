export type AppointmentStage = 'SCHEDULED' | 'REMIND_24H' | 'REMIND_2H' | 'DONE';

export interface AppointmentLike {
  startsAt: string; // ISO string
  stage: AppointmentStage;
  doctor: string;
  place: string;
  notes?: string;
}

export interface AppointmentEmailIntent {
  recipientRoles: ('ELDER' | 'CARETAKER')[];
  stage: 'REMIND_24H' | 'REMIND_2H';
  subject: string;
}

export interface AppointmentTransitionResult {
  nextStage?: AppointmentStage;
  nextActionAt?: string;
  isTerminal: boolean;
  emails: AppointmentEmailIntent[];
}

export interface AppointmentSettings {
  appointmentReminders: number[]; // [1440, 120] minutes before startsAt
}

/**
 * Pure state machine for appointment reminders following Spec section 6.4
 * SCHEDULED -> REMIND_24H -> REMIND_2H -> DONE
 */
export function nextAppointmentStage(
  appt: AppointmentLike,
  settings: AppointmentSettings,
  now: Date
): AppointmentTransitionResult {
  if (appt.stage === 'DONE') {
    return {
      isTerminal: true,
      emails: [],
    };
  }

  const startsAtMs = new Date(appt.startsAt).getTime();
  const nowMs = now.getTime();

  // If appointment start time has passed, transition to DONE
  if (nowMs >= startsAtMs) {
    return {
      nextStage: 'DONE',
      isTerminal: true,
      emails: [],
    };
  }

  const remind1Minutes = settings.appointmentReminders?.[0] ?? 1440;
  const remind2Minutes = settings.appointmentReminders?.[1] ?? 120;

  const remind1Ms = startsAtMs - remind1Minutes * 60 * 1000;
  const remind2Ms = startsAtMs - remind2Minutes * 60 * 1000;

  if (appt.stage === 'SCHEDULED') {
    if (nowMs >= remind2Ms) {
      return {
        nextStage: 'REMIND_2H',
        nextActionAt: new Date(startsAtMs).toISOString(),
        isTerminal: false,
        emails: [
          {
            recipientRoles: ['ELDER', 'CARETAKER'],
            stage: 'REMIND_2H',
            subject: `Upcoming Appointment in 2 Hours: Dr. ${appt.doctor}`,
          },
        ],
      };
    }

    if (nowMs >= remind1Ms) {
      return {
        nextStage: 'REMIND_24H',
        nextActionAt: new Date(remind2Ms).toISOString(),
        isTerminal: false,
        emails: [
          {
            recipientRoles: ['ELDER', 'CARETAKER'],
            stage: 'REMIND_24H',
            subject: `Upcoming Doctor Appointment Tomorrow: Dr. ${appt.doctor}`,
          },
        ],
      };
    }

    return {
      nextActionAt: new Date(remind1Ms).toISOString(),
      isTerminal: false,
      emails: [],
    };
  }

  if (appt.stage === 'REMIND_24H') {
    if (nowMs >= remind2Ms) {
      return {
        nextStage: 'REMIND_2H',
        nextActionAt: new Date(startsAtMs).toISOString(),
        isTerminal: false,
        emails: [
          {
            recipientRoles: ['ELDER', 'CARETAKER'],
            stage: 'REMIND_2H',
            subject: `Upcoming Appointment in 2 Hours: Dr. ${appt.doctor}`,
          },
        ],
      };
    }

    return {
      nextActionAt: new Date(remind2Ms).toISOString(),
      isTerminal: false,
      emails: [],
    };
  }

  if (appt.stage === 'REMIND_2H') {
    return {
      nextActionAt: new Date(startsAtMs).toISOString(),
      isTerminal: false,
      emails: [],
    };
  }

  return {
    isTerminal: false,
    emails: [],
  };
}
