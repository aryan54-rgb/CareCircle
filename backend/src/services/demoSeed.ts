import bcrypt from 'bcryptjs';
import { circleRepo, DEFAULT_CIRCLE_SETTINGS } from '../db/repos/circleRepo.js';
import { memberRepo } from '../db/repos/memberRepo.js';
import { authRepo } from '../db/repos/authRepo.js';
import { medRepo } from '../db/repos/medRepo.js';
import { doseRepo } from '../db/repos/doseRepo.js';
import { apptRepo } from '../db/repos/apptRepo.js';
import { suggestionRepo } from '../db/repos/suggestionRepo.js';
import { activityService } from './activity.js';
import { generateDoses } from '../domain/scheduleGenerator.js';
import { addDays, formatDateInTimezone, timeStringToUTC } from '../lib/time.js';
import { logger } from '../lib/logger.js';

export interface SeedOptions {
  elderEmail?: string;
  caretakerEmail?: string;
  familyEmail?: string;
}

/**
 * Seeds or resets the "demo-circle" with realistic data
 */
export async function seedDemoCircle(options: SeedOptions = {}) {
  const circleId = 'demo-circle';
  const tz = 'Asia/Kolkata';

  const elderEmail = options.elderEmail || process.env.ELDER_EMAIL || 'shanti@demo.com';
  const caretakerEmail = options.caretakerEmail || process.env.CARETAKER_EMAIL || 'rajesh@demo.com';
  const familyEmail = options.familyEmail || process.env.FAMILY_EMAIL || 'priya@demo.com';

  logger.info(`[DemoSeed] Seeding demo-circle (${elderEmail}, ${caretakerEmail}, ${familyEmail})...`);

  // 1. Create Demo Circle
  await circleRepo.create({
    circleId,
    name: 'Kalyan Family Circle',
    elderName: 'Grandmother Shanti',
    timezone: tz,
    settings: {
      ...DEFAULT_CIRCLE_SETTINGS,
      demoMode: true,
      timezone: tz,
    },
  });

  // 2. Create Members
  const members = [
    {
      id: 'shanti-elder',
      name: 'Grandmother Shanti',
      email: elderEmail,
      role: 'ELDER' as const,
      passcode: 'shanti123',
    },
    {
      id: 'rajesh-son',
      name: 'Son Rajesh',
      email: caretakerEmail,
      role: 'CARETAKER' as const,
      passcode: 'rajesh123',
    },
    {
      id: 'anita-nurse',
      name: 'Nurse Anita',
      email: 'anita@demo.com',
      role: 'CARETAKER' as const,
      passcode: 'anita123',
    },
    {
      id: 'priya-daughter',
      name: 'Daughter Priya',
      email: familyEmail,
      role: 'FAMILY' as const,
      passcode: 'priya123',
    },
  ];

  for (const m of members) {
    const hash = await bcrypt.hash(m.passcode, 10);
    await memberRepo.create({
      circleId,
      memberId: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      passcodeHash: hash,
    });
    await authRepo.setLoginLookup(m.email, circleId, m.id);
  }

  // 3. Create Medications
  const todayStr = formatDateInTimezone(new Date(), tz);

  const med1 = await medRepo.create({
    medId: 'med-metformin',
    circleId,
    name: 'Metformin',
    strength: '500mg',
    form: 'tablet',
    instructions: 'Take with or immediately after meals',
    times: ['09:00', '21:00'],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: todayStr,
    active: true,
    pillCount: 28,
    refillThreshold: 6,
  });

  const med2 = await medRepo.create({
    medId: 'med-amlodipine',
    circleId,
    name: 'Amlodipine',
    strength: '5mg',
    form: 'tablet',
    instructions: 'Take in the morning for blood pressure',
    times: ['08:00'],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: todayStr,
    active: true,
    pillCount: 14,
    refillThreshold: 5,
  });

  const med3 = await medRepo.create({
    medId: 'med-atorvastatin',
    circleId,
    name: 'Atorvastatin',
    strength: '10mg',
    form: 'tablet',
    instructions: 'Take at bedtime for cholesterol',
    times: ['21:30'],
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startDate: todayStr,
    active: true,
    pillCount: 4, // Trigger refill warning!
    refillThreshold: 5,
  });

  // Materialise 7 days of future doses
  for (const med of [med1, med2, med3]) {
    const doses = generateDoses(med, circleId, tz, 0, 7, new Date());
    await doseRepo.batchCreate(doses);
  }

  // 4. Generate Past 6 Days of Realistic Doses for Adherence Chart
  for (let offset = 6; offset >= 1; offset--) {
    const pastDate = addDays(new Date(), -offset);
    const pastDateStr = formatDateInTimezone(pastDate, tz);

    const dueAmlodipine = timeStringToUTC(pastDateStr, '08:00', tz);
    await doseRepo.batchCreate([
      {
        circleId,
        medId: med2.medId,
        medName: med2.name,
        dueAt: dueAmlodipine,
        status: 'SCHEDULED',
        nextActionAt: dueAmlodipine,
        GSI1PK: 'OPEN',
        GSI1SK: dueAmlodipine,
      },
    ]);
    await doseRepo.markTaken(circleId, dueAmlodipine, med2.medId, 'shanti-elder', 'Grandmother Shanti');

    const dueMetforminAm = timeStringToUTC(pastDateStr, '09:00', tz);
    await doseRepo.batchCreate([
      {
        circleId,
        medId: med1.medId,
        medName: med1.name,
        dueAt: dueMetforminAm,
        status: 'SCHEDULED',
        nextActionAt: dueMetforminAm,
        GSI1PK: 'OPEN',
        GSI1SK: dueMetforminAm,
      },
    ]);

    if (offset === 3) {
      await doseRepo.markSkipped(circleId, dueMetforminAm, med1.medId, 'shanti-elder', 'Grandmother Shanti');
    } else {
      await doseRepo.markTaken(circleId, dueMetforminAm, med1.medId, 'shanti-elder', 'Grandmother Shanti');
    }
  }

  // 5. Create Appointments
  const apptDate = addDays(new Date(), 3).toISOString().split('T')[0] + 'T10:30:00.000Z';
  await apptRepo.create({
    circleId,
    doctor: 'Dr. Ramesh Sharma (Cardiologist)',
    place: 'Apollo Heart Clinic, Suite 302',
    notes: 'Routine blood pressure review. Bring blood pressure log book.',
    startsAt: apptDate,
  });

  // 6. Create Pending Suggestion
  await suggestionRepo.create({
    circleId,
    type: 'NEW_MED',
    title: 'Vitamin D3 1000 IU Daily',
    payload: {
      name: 'Vitamin D3',
      strength: '1000 IU',
      form: 'capsule',
      instructions: 'Take 1 capsule with milk after breakfast',
      times: ['09:30'],
      startDate: todayStr,
      pillCount: 60,
      refillThreshold: 10,
    },
    proposedBy: 'priya-daughter',
    proposedByName: 'Daughter Priya',
    proposedByRole: 'FAMILY',
  });

  // 7. Log Activity Feed
  await activityService.log({
    circleId,
    actorId: 'rajesh-son',
    actorName: 'Son Rajesh',
    action: 'CREATE_CIRCLE',
    summary: 'Created Kalyan Family Circle for Grandmother Shanti.',
  });
  await activityService.log({
    circleId,
    actorId: 'priya-daughter',
    actorName: 'Daughter Priya',
    action: 'SUBMIT_SUGGESTION',
    summary: 'Daughter Priya suggested adding Vitamin D3 1000 IU Daily.',
  });
  await activityService.log({
    circleId,
    actorId: 'anita-nurse',
    actorName: 'Nurse Anita',
    action: 'CREATE_APPOINTMENT',
    summary: 'Nurse Anita scheduled cardiology appointment with Dr. Ramesh Sharma.',
  });

  return { circleId, status: 'seeded' };
}
