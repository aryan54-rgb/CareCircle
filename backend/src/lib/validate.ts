import { z } from 'zod';

export const RoleEnum = z.enum(['ELDER', 'CARETAKER', 'FAMILY']);
export type Role = z.infer<typeof RoleEnum>;

export const createCircleSchema = z.object({
  name: z.string().min(2).max(100),
  elderName: z.string().min(2).max(100),
  caretakerName: z.string().min(2).max(100),
  caretakerEmail: z.string().email(),
  caretakerPasscode: z.string().min(4).max(20),
  timezone: z.string().default('Asia/Kolkata'),
});

export const joinCircleSchema = z.object({
  inviteCode: z.string().min(4).max(10),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  passcode: z.string().min(4).max(20),
});

export const loginSchema = z.object({
  email: z.string().email(),
  passcode: z.string().min(4).max(20),
});

export const createInviteSchema = z.object({
  role: RoleEnum,
});

export const updateSettingsSchema = z.object({
  preMinutes: z.number().int().min(0).max(60).optional(),
  escalate1Minutes: z.number().int().min(1).max(120).optional(),
  escalate2Minutes: z.number().int().min(1).max(240).optional(),
  missedMinutes: z.number().int().min(1).max(360).optional(),
  appointmentReminders: z.array(z.number().int().positive()).optional(),
  demoMode: z.boolean().optional(),
  timezone: z.string().optional(),
});

export const createMedicationSchema = z.object({
  name: z.string().min(2).max(100),
  strength: z.string().min(1).max(50),
  form: z.string().min(1).max(50).default('tablet'),
  instructions: z.string().max(500).default(''),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:mm')).min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([0, 1, 2, 3, 4, 5, 6]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  pillCount: z.number().int().min(0).optional(),
  refillThreshold: z.number().int().min(0).optional(),
});

export const updateMedicationSchema = createMedicationSchema.partial().extend({
  active: z.boolean().optional(),
});

