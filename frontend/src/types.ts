/**
 * Shared TypeScript types and interfaces for CareCircle Frontend
 */

export type Role = 'ELDER' | 'CARETAKER' | 'FAMILY';

export type DoseStatus =
  | 'SCHEDULED'
  | 'REMINDED'
  | 'ESCALATED_1'
  | 'ESCALATED_2'
  | 'TAKEN'
  | 'SKIPPED'
  | 'MISSED';

export interface DoseItem {
  id: string;
  circleId: string;
  medId: string;
  medName: string;
  dueAt: string;
  status: DoseStatus;
  nextActionAt?: string;
  takenAt?: string;
  takenBy?: string;
  takenByName?: string;
  skippedAt?: string;
  skippedBy?: string;
  GSI1PK?: 'OPEN';
  GSI1SK?: string;
  retryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodayDosesResponse {
  heroDose: DoseItem | null;
  doses: DoseItem[];
}

export interface Medication {
  medId: string;
  circleId: string;
  name: string;
  strength: string;
  form: string;
  instructions: string;
  times: string[];
  startDate: string;
  pillCount: number;
  refillThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStage = 'SCHEDULED' | 'REMIND_24H' | 'REMIND_2H' | 'DONE';

export interface Appointment {
  id: string;
  circleId: string;
  doctor: string;
  place: string;
  startsAt: string;
  notes?: string;
  stage: AppointmentStage;
  nextActionAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationAdherenceStat {
  medId: string;
  name: string;
  scheduledCount: number;
  takenCount: number;
  skippedCount: number;
  missedCount: number;
  rate: number;
}

export interface DayAdherence {
  date: string;
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  rate: number;
}

export interface AdherenceReport {
  overallRate: number;
  scheduledCount: number;
  takenCount: number;
  skippedCount: number;
  missedCount: number;
  days: DayAdherence[];
  medicationStats: MedicationAdherenceStat[];
}

export type SuggestionType = 'NEW_MED' | 'CHANGE_MED' | 'APPOINTMENT';
export type SuggestionStatus = 'PENDING' | 'PROPOSED' | 'APPROVED' | 'DECLINED';

export interface Suggestion {
  id: string;
  circleId: string;
  type: SuggestionType;
  title: string;
  payload: Record<string, unknown>;
  proposedBy: string;
  proposedByName: string;
  proposedByRole: Role;
  status: SuggestionStatus;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  circleId: string;
  actorId: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface NotificationLog {
  id: string;
  circleId: string;
  to: string;
  subject: string;
  stage: string;
  success: boolean;
  error?: string;
  sentAt?: string;
  createdAt?: string;
  ttl?: number;
}

export interface CircleMember {
  memberId: string;
  circleId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface CircleSettings {
  remindMinutesBefore: number;
  escalation1Minutes: number;
  escalation2Minutes: number;
  missedAfterMinutes: number;
  dailyDigestHourUTC: number;
  preMinutes?: number;
  demoMode?: boolean;
  timezone?: string;
  appointmentReminders?: number[];
}

export interface CircleDetail {
  circleId: string;
  name: string;
  elderName: string;
  timezone: string;
  settings: CircleSettings;
  createdAt: string;
  members: CircleMember[];
}

export interface DeepHealthCheck {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  components?: {
    dynamodb?: {
      status: 'ok' | 'error';
      latencyMs: number;
      table: string;
    };
    ses?: {
      status: 'ok' | 'error';
      sendingEnabled: boolean;
      productionAccess: boolean;
      identityVerified: boolean;
      fromAddress: string;
    };
    bedrock?: {
      status: 'ok' | 'error';
      modelId: string;
      region: string;
      cached: boolean;
      message?: string;
    };
  };
  error?: string;
}

export interface ExtractedPrescription {
  name?: string;
  strength?: string;
  form?: string;
  frequency?: string;
  times?: string[];
  durationDays?: number;
  instructions?: string;
  confidence?: number;
}

export interface ScanPrescriptionResponse {
  extracted?: ExtractedPrescription;
  rawText?: string;
}

export interface UserProfile {
  memberId: string;
  circleId: string;
  name: string;
  email: string;
  role: Role;
}
