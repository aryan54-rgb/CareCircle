/**
 * CareCircle Hackathon Demo Seeder
 * Populates realistic demo dataset:
 * - Circle: "Kalyan Family Circle"
 * - Elder: Grandmother Shanti (shanti@demo.com / shanti123)
 * - Caretaker (Son): Son Rajesh (rajesh@demo.com / rajesh123)
 * - Caretaker (Nurse): Nurse Anita (anita@demo.com / anita123)
 * - Family: Daughter Priya (priya@demo.com / priya123)
 * - Medications: Metformin 500mg, Amlodipine 5mg, Atorvastatin 10mg
 * - Appointments: Dr. Ramesh Sharma (Cardiologist)
 * - Suggestions: Daughter suggested Vitamin D3
 * - Past adherence history for Recharts visualization
 */
import bcrypt from 'bcryptjs';
import { circleRepo, DEFAULT_CIRCLE_SETTINGS } from '../backend/src/db/repos/circleRepo.js';
import { memberRepo } from '../backend/src/db/repos/memberRepo.js';
import { authRepo } from '../backend/src/db/repos/authRepo.js';
import { medRepo } from '../backend/src/db/repos/medRepo.js';
import { doseRepo } from '../backend/src/db/repos/doseRepo.js';
import { apptRepo } from '../backend/src/db/repos/apptRepo.js';
import { suggestionRepo } from '../backend/src/db/repos/suggestionRepo.js';
import { activityService } from '../backend/src/services/activity.js';
import { generateDoses } from '../backend/src/domain/scheduleGenerator.js';
import { addDays, formatDateInTimezone, timeStringToUTC } from '../backend/src/lib/time.js';

process.env.TABLE_NAME = process.env.TABLE_NAME || 'carecircle-dev-table';
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

async function seed() {
  console.log('🌱 Seeding CareCircle Demo Dataset...\n');

  const circleId = 'demo-circle';
  const tz = 'Asia/Kolkata';

  // 1. Create Demo Circle
  console.log('1. Creating Kalyan Family Circle...');
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
  console.log('2. Creating Circle Members...');
  const members = [
    {
      id: 'shanti-elder',
      name: 'Grandmother Shanti',
      email: 'shanti@demo.com',
      role: 'ELDER' as const,
      passcode: 'shanti123',
    },
    {
      id: 'rajesh-son',
      name: 'Son Rajesh',
      email: 'rajesh@demo.com',
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
      email: 'priya@demo.com',
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
    console.log(`   - ${m.name} (${m.role}): ${m.email} / ${m.passcode}`);
  }

  // 3. Create Medications
  console.log('\n3. Creating Medications...');
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
  console.log('4. Generating Schedules...');
  for (const med of [med1, med2, med3]) {
    const doses = generateDoses(
      {
        medId: med.medId,
        name: med.name,
        times: med.times,
        daysOfWeek: med.daysOfWeek,
        startDate: med.startDate,
      },
      circleId,
      tz,
      0,
      7
    );
    await doseRepo.batchCreate(doses);
  }

  // 4. Generate Past 6 Days of Realistic Doses for Adherence Chart
  console.log('5. Populating Past Adherence History...');
  for (let offset = 6; offset >= 1; offset--) {
    const pastDate = addDays(new Date(), -offset);
    const pastDateStr = formatDateInTimezone(pastDate, tz);

    // Morning Amlodipine
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
    // Mark as taken
    await doseRepo.markTaken(circleId, dueAmlodipine, med2.medId, 'shanti-elder', 'Grandmother Shanti');

    // Morning Metformin
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
      // simulate 1 missed dose 3 days ago
      await doseRepo.markSkipped(circleId, dueMetforminAm, med1.medId, 'shanti-elder', 'Grandmother Shanti');
    } else {
      await doseRepo.markTaken(circleId, dueMetforminAm, med1.medId, 'shanti-elder', 'Grandmother Shanti');
    }
  }

  // 5. Create Appointments
  console.log('6. Scheduling Appointments...');
  const apptDate = addDays(new Date(), 3).toISOString().split('T')[0] + 'T10:30:00.000Z';
  await apptRepo.create({
    circleId,
    doctor: 'Dr. Ramesh Sharma (Cardiologist)',
    place: 'Apollo Heart Clinic, Suite 302',
    notes: 'Routine blood pressure review. Bring blood pressure log book.',
    startsAt: apptDate,
  });

  // 6. Create Pending Suggestion from Daughter
  console.log('7. Creating Pending Suggestion from Daughter...');
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
  console.log('8. Recording Activity Log...');
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

  console.log('\n✨ Demo Dataset Seeded Successfully!');
  console.log('----------------------------------------------------');
  console.log('Demo Circle: Kalyan Family Circle');
  console.log('Elder Login:     shanti@demo.com  / shanti123 (Simpler 3-Tab UI)');
  console.log('Caretaker Login: rajesh@demo.com  / rajesh123 (Full Management)');
  console.log('Family Login:    priya@demo.com   / priya123  (View & Suggest)');
  console.log('----------------------------------------------------');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
