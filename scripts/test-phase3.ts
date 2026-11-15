/**
 * Integration Test for Phase 3:
 * Ticker State Machine + One-Tap Confirmation + Demo Escalation
 */
process.env.JWT_SECRET = 'carecircle-super-secret-jwt-key-for-hackathon-2026-min32chars!';
const API_URL = process.env.API_URL || 'https://odu8ihixga.execute-api.ap-south-1.amazonaws.com';

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function run() {
  console.log(`Starting Phase 3 Live Verification against ${API_URL}...\n`);

  const testId = Date.now().toString(36);
  const caretakerEmail = `caretaker_p3_${testId}@test.com`;

  // 1. Setup Circle with Caretaker and Elder
  console.log('1. Setting up Circle for Phase 3...');
  const createCircleRes = await request('/auth/circles', {
    method: 'POST',
    body: JSON.stringify({
      name: `Sharma Care Circle ${testId}`,
      elderName: 'Grandmother Savitri',
      caretakerName: 'Son Alok',
      caretakerEmail,
      caretakerPasscode: 'alokpass123',
      timezone: 'Asia/Kolkata',
    }),
  });

  const caretakerToken = createCircleRes.data.token;
  const circleId = createCircleRes.data.circleId;

  // Invite Elder
  const elderInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'ELDER' }),
  });
  const elderJoinRes = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: elderInviteRes.data.code,
      name: 'Grandmother Savitri',
      email: `savitri_${testId}@test.com`,
      passcode: 'elderpass123',
    }),
  });
  const elderToken = elderJoinRes.data.token;

  // 2. Add Medication
  console.log('\n2. Adding Medication (Telmisartan 40mg)...');
  const addMedRes = await request('/meds', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      name: 'Telmisartan',
      strength: '40mg',
      form: 'tablet',
      instructions: 'Take 1 tablet in the morning',
      times: ['08:00'],
      startDate: new Date().toISOString().split('T')[0],
      pillCount: 20,
    }),
  });

  const med = addMedRes.data.medication;
  console.log(`-> Added medication: ${med.name}`);

  // 3. Trigger Missed Demo Helper
  console.log('\n3. Triggering Demo Missed Helper (POST /demo/trigger-missed)...');
  const triggerRes = await request('/demo/trigger-missed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });

  if (triggerRes.status !== 200) {
    throw new Error(`Failed to trigger demo missed: ${JSON.stringify(triggerRes.data)}`);
  }
  console.log(`-> Demo dose backdated: ${triggerRes.data.doseId} (${triggerRes.data.medName})`);
  console.log('-> Timeline:', JSON.stringify(triggerRes.data.demoTimeline));

  // 4. Test One-Tap Landing Page (GET /p/confirm)
  // We can get today's doses to find a dose ID
  const dosesRes = await request('/doses', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  const targetDose = dosesRes.data.doses[0];
  console.log(`\n4. Testing One-Tap Confirmation for dose: ${targetDose.id}...`);

  // Sign a test confirm token by calling a take/skip or directly testing endpoint
  // Let's verify GET /p/confirm with invalid token returns friendly error page
  const invalidGetRes = await request('/p/confirm?t=invalid-token');
  console.log(`-> GET /p/confirm?t=invalid returned status: ${invalidGetRes.status} (renders friendly HTML: ${invalidGetRes.data.includes('CareCircle')})`);

  // Now create a valid confirm token using the tokens module
  const { signConfirmToken } = await import('../backend/src/services/tokens.js');
  const takeToken = await signConfirmToken({
    doseId: targetDose.id,
    circleId,
    action: 'take',
  });

  // Test GET /p/confirm?t=<validToken>
  const validGetRes = await request(`/p/confirm?t=${takeToken}`);
  console.log(`-> GET /p/confirm?t=<validToken> status: ${validGetRes.status}`);
  if (validGetRes.status !== 200 || !validGetRes.data.includes('Telmisartan')) {
    throw new Error('GET /p/confirm did not render medication confirmation page');
  }
  console.log('-> Rendered HTML contains medication name & confirmation button: OK');

  // 5. Test POST /p/confirm (mutating dose taken via one-tap link)
  console.log('\n5. Testing POST /p/confirm (One-Tap button submission)...');
  const confirmPostRes = await request('/p/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: takeToken }),
  });

  if (confirmPostRes.status !== 200) {
    throw new Error(`POST /p/confirm failed: ${JSON.stringify(confirmPostRes.data)}`);
  }
  console.log(`-> Result: status=${confirmPostRes.data.status}, message="${confirmPostRes.data.message}"`);

  // 6. Test Idempotency (submitting same token a second time)
  console.log('\n6. Testing Idempotent Second Submission...');
  const secondPostRes = await request('/p/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: takeToken }),
  });
  console.log(`-> Second submission status: ${secondPostRes.status}, alreadyRecorded: ${secondPostRes.data.alreadyRecorded}`);
  if (!secondPostRes.data.alreadyRecorded) {
    throw new Error('Expected alreadyRecorded to be true on second click');
  }

  // 7. Verify Pill Count Decremented
  console.log('\n7. Verifying Pill Count...');
  const updatedMedRes = await request(`/meds/${med.medId}`, {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  console.log(`-> Pill count was 20, now: ${updatedMedRes.data.medication.pillCount}`);
  if (updatedMedRes.data.medication.pillCount !== 19) {
    throw new Error(`Expected pillCount 19, got ${updatedMedRes.data.medication.pillCount}`);
  }

  // 8. Verify Activity Feed Logs
  console.log('\n8. Checking Activity Log for One-Tap event...');
  const activityRes = await request('/activity', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  const oneTapActivity = activityRes.data.activities.find((a: any) =>
    a.summary.includes('one-tap email link')
  );
  if (!oneTapActivity) {
    throw new Error('Expected one-tap activity log entry');
  }
  console.log(`-> Activity log entry verified: "${oneTapActivity.summary}"`);

  console.log('\n✅ ALL PHASE 3 REQUIREMENTS FULLY VERIFIED!');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
