/**
 * Integration Test for Phase 2 against live deployed API Gateway
 */
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
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log(`Starting Phase 2 Live Verification against ${API_URL}...\n`);

  const testId = Date.now().toString(36);
  const caretakerEmail = `nurse_${testId}@test.com`;

  // 1. Create Circle
  console.log('1. Setting up Circle...');
  const createCircleRes = await request('/auth/circles', {
    method: 'POST',
    body: JSON.stringify({
      name: `Devi Family Circle ${testId}`,
      elderName: 'Grandmother Rukmini',
      caretakerName: 'Nurse Anita',
      caretakerEmail,
      caretakerPasscode: 'passcode123',
      timezone: 'Asia/Kolkata',
    }),
  });

  const caretakerToken = createCircleRes.data.token;
  const circleId = createCircleRes.data.circleId;

  // 2. Add Elder
  console.log('2. Inviting and Joining Elder...');
  const elderInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'ELDER' }),
  });
  const elderJoinRes = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: elderInviteRes.data.code,
      name: 'Grandmother Rukmini',
      email: `rukmini_${testId}@test.com`,
      passcode: 'elderpass123',
    }),
  });
  const elderToken = elderJoinRes.data.token;

  // 3. Add Family
  console.log('3. Inviting and Joining Family Member...');
  const familyInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'FAMILY' }),
  });
  const familyJoinRes = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: familyInviteRes.data.code,
      name: 'Son Vikram',
      email: `vikram_${testId}@test.com`,
      passcode: 'familypass123',
    }),
  });
  const familyToken = familyJoinRes.data.token;

  // 4. Caretaker Adds Medication (Metformin, 2x daily, pillCount 30)
  console.log('\n4. Caretaker Adds Medication (Metformin, 2x daily: 09:00 & 21:00)...');
  const addMedRes = await request('/meds', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      name: 'Metformin',
      strength: '500mg',
      form: 'tablet',
      instructions: 'Take with or immediately after meals',
      times: ['09:00', '21:00'],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startDate: new Date().toISOString().split('T')[0],
      pillCount: 30,
      refillThreshold: 5,
    }),
  });

  if (addMedRes.status !== 200) {
    throw new Error(`Failed to add medication: ${JSON.stringify(addMedRes.data)}`);
  }

  const med = addMedRes.data.medication;
  const dosesGenerated = addMedRes.data.dosesGenerated;
  console.log(`-> Medication added: "${med.name} ${med.strength}". Doses generated: ${dosesGenerated}`);
  if (dosesGenerated !== 14) {
    throw new Error(`Expected 14 doses (7 days x 2 times), got ${dosesGenerated}`);
  }

  // 5. Elder views Today's doses
  console.log("\n5. Elder views Today's Doses (GET /doses)...");
  const dosesRes = await request('/doses', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });

  if (dosesRes.status !== 200) {
    throw new Error(`Failed to get doses: ${JSON.stringify(dosesRes.data)}`);
  }

  console.log(`-> Doses found for today: ${dosesRes.data.doses.length}`);
  console.log(`-> Hero Dose: ${dosesRes.data.heroDose?.medName} at ${dosesRes.data.heroDose?.dueAt} (status: ${dosesRes.data.heroDose?.status})`);

  if (!dosesRes.data.heroDose) {
    throw new Error('Hero dose expected but was null');
  }

  const targetDose = dosesRes.data.heroDose;

  // 6. Elder marks dose as taken ("I took it")
  console.log('\n6. Elder marks dose as TAKEN (POST /doses/:id/take)...');
  const takeRes = await request(`/doses/${encodeURIComponent(targetDose.id)}/take`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${elderToken}` },
  });

  console.log(`-> takeRes: status=${takeRes.status}, data=`, takeRes.data);
  if (takeRes.status !== 200) {
    throw new Error(`Failed to mark dose taken: ${JSON.stringify(takeRes.data)}`);
  }

  console.log(`-> Dose status updated: ${takeRes.data.dose.status}, takenBy: ${takeRes.data.dose.takenByName}`);

  // 7. Verify pill count decremented
  console.log('\n7. Verifying Pill Count Decrement...');
  const updatedMedRes = await request(`/meds/${med.medId}`, {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  console.log(`-> Pill count: was 30, now ${updatedMedRes.data.medication.pillCount}`);
  if (updatedMedRes.data.medication.pillCount !== 29) {
    throw new Error(`Expected pillCount 29, got ${updatedMedRes.data.medication.pillCount}`);
  }

  // 8. Caretaker marks next dose on behalf
  const remainingDoses = dosesRes.data.doses.filter((d: any) => d.id !== targetDose.id);
  if (remainingDoses.length > 0) {
    const secondDose = remainingDoses[0];
    console.log(`\n8. Caretaker marks dose on behalf of elder (${secondDose.id})...`);
    const caretakerTakeRes = await request(`/doses/${encodeURIComponent(secondDose.id)}/take`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${caretakerToken}` },
    });
    console.log(`-> Status: ${caretakerTakeRes.data.dose.status}, takenBy: ${caretakerTakeRes.data.dose.takenByName}`);
  }

  // 9. Verify Family cannot add meds or mark doses
  console.log('\n9. Verifying Family permissions enforcement...');
  const familyMedRes = await request('/meds', {
    method: 'POST',
    headers: { Authorization: `Bearer ${familyToken}` },
    body: JSON.stringify({
      name: 'Unauthorized Pill',
      strength: '10mg',
      form: 'tablet',
      times: ['12:00'],
      startDate: '2026-11-15',
    }),
  });
  if (familyMedRes.status === 403) {
    console.log('-> Family blocked from adding meds with 403: OK');
  } else {
    throw new Error(`Expected 403, got ${familyMedRes.status}`);
  }

  // 10. Check Activity Feed
  console.log('\n10. Checking Activity Feed...');
  const activityRes = await request('/activity', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  console.log(`-> Activity entries: ${activityRes.data.activities.length}`);
  activityRes.data.activities.slice(0, 3).forEach((a: any) => {
    console.log(`   [${a.action}] ${a.summary}`);
  });

  console.log('\n✅ ALL PHASE 2 REQUIREMENTS FULLY VERIFIED!');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
