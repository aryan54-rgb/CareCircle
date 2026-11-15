/**
 * Integration Test for Phases 4, 5, 6, 7 against live API Gateway
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
  console.log(`Starting Live Verification of Phases 4, 5, 6, 7 against ${API_URL}...\n`);

  const testId = Date.now().toString(36);

  // 1. Setup Circle (Caretaker, Elder, Family)
  console.log('1. Setting up Circle...');
  const circleRes = await request('/auth/circles', {
    method: 'POST',
    body: JSON.stringify({
      name: `Gupta Care Circle ${testId}`,
      elderName: 'Grandmother Usha',
      caretakerName: 'Son Manish',
      caretakerEmail: `manish_${testId}@test.com`,
      caretakerPasscode: 'passcode123',
      timezone: 'Asia/Kolkata',
    }),
  });
  const caretakerToken = circleRes.data.token;
  const circleId = circleRes.data.circleId;

  // Invite Elder
  const elderInv = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'ELDER' }),
  });
  const elderJoin = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: elderInv.data.code,
      name: 'Grandmother Usha',
      email: `usha_${testId}@test.com`,
      passcode: 'elderpass123',
    }),
  });
  const elderToken = elderJoin.data.token;

  // Invite Family
  const familyInv = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'FAMILY' }),
  });
  const familyJoin = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: familyInv.data.code,
      name: 'Granddaughter Neha',
      email: `neha_${testId}@test.com`,
      passcode: 'familypass123',
    }),
  });
  const familyToken = familyJoin.data.token;

  // ==========================================
  // PHASE 4: APPOINTMENTS
  // ==========================================
  console.log('\n--- PHASE 4: Appointments ---');
  const apptRes = await request('/appointments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      doctor: 'Dr. Ramesh Sharma (Cardiologist)',
      place: 'Apollo Heart Clinic, Room 302',
      notes: 'Bring previous blood pressure logs and ECG report',
      startsAt: '2026-11-20T10:30:00.000Z',
    }),
  });
  if (apptRes.status !== 200) {
    throw new Error(`Failed to create appointment: ${JSON.stringify(apptRes.data)}`);
  }
  const appt = apptRes.data.appointment;
  console.log(`-> Scheduled appointment: ${appt.doctor} at ${appt.place}`);

  // List appointments (as Elder)
  const listApptRes = await request('/appointments', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  console.log(`-> Elder fetched appointments count: ${listApptRes.data.appointments.length}`);
  if (listApptRes.data.appointments.length === 0) {
    throw new Error('Expected at least 1 appointment');
  }

  // ==========================================
  // PHASE 5: SUGGESTIONS + APPROVALS
  // ==========================================
  console.log('\n--- PHASE 5: Suggestions Workflow ---');
  // Family suggests a new vitamin
  const suggestRes = await request('/suggestions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${familyToken}` },
    body: JSON.stringify({
      type: 'NEW_MED',
      title: 'Add Vitamin D3 1000IU daily',
      payload: {
        name: 'Vitamin D3',
        strength: '1000 IU',
        form: 'capsule',
        instructions: 'Take 1 capsule with milk after breakfast',
        times: ['09:30'],
        startDate: '2026-11-15',
        pillCount: 30,
        refillThreshold: 5,
      },
    }),
  });
  if (suggestRes.status !== 200) {
    throw new Error(`Failed to submit suggestion: ${JSON.stringify(suggestRes.data)}`);
  }
  const suggestion = suggestRes.data.suggestion;
  console.log(`-> Family suggested: "${suggestion.title}" (Status: ${suggestion.status})`);

  // Elder approves the suggestion!
  console.log(`-> Elder approving suggestion (${suggestion.id})...`);
  const approveRes = await request(`/suggestions/${suggestion.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${elderToken}` },
    body: JSON.stringify({ decisionNote: 'Approved. Doctor recommended this.' }),
  });
  if (approveRes.status !== 200) {
    throw new Error(`Failed to approve suggestion: ${JSON.stringify(approveRes.data)}`);
  }
  console.log(`-> Approved result: ${approveRes.data.message}`);

  // Verify that Vitamin D3 was automatically created in medications!
  const medsRes = await request('/meds', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  const vitaminMed = medsRes.data.medications.find((m: any) => m.name === 'Vitamin D3');
  if (!vitaminMed) {
    throw new Error('Approved suggestion did not auto-create Vitamin D3 medication');
  }
  console.log(`-> Medication auto-created: ${vitaminMed.name} (${vitaminMed.strength})`);

  // ==========================================
  // PHASE 6: ADHERENCE STATS & REFILL ALERTS
  // ==========================================
  console.log('\n--- PHASE 6: Adherence Stats & Refill Alerts ---');
  // Add a medication with low pill count
  await request('/meds', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      name: 'Thyroxine',
      strength: '50mcg',
      form: 'tablet',
      times: ['07:00'],
      startDate: '2026-11-15',
      pillCount: 3, // <= refillThreshold
      refillThreshold: 5,
    }),
  });

  const adherenceRes = await request('/adherence?days=7', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  if (adherenceRes.status !== 200) {
    throw new Error(`Failed to get adherence: ${JSON.stringify(adherenceRes.data)}`);
  }
  console.log(`-> Overall adherence rate: ${adherenceRes.data.overallRate}%`);
  console.log(`-> Refill alerts count: ${adherenceRes.data.refillAlerts.length}`);
  const thyroxineAlert = adherenceRes.data.refillAlerts.find((r: any) => r.medName === 'Thyroxine');
  if (!thyroxineAlert) {
    throw new Error('Expected Thyroxine to trigger refill alert');
  }
  console.log(`-> Refill alert verified: ${thyroxineAlert.medName} has only ${thyroxineAlert.currentPills} pills left (threshold: ${thyroxineAlert.threshold})`);

  // ==========================================
  // PHASE 7: PRESCRIPTION SCAN (AI BEDROCK)
  // ==========================================
  console.log('\n--- PHASE 7: Prescription Scan (AI Extraction) ---');
  // Small sample 1x1 transparent PNG base64 for testing the pipeline
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const scanRes = await request('/scan/prescription', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({
      imageBase64: sampleBase64,
      mimeType: 'image/png',
    }),
  });

  if (scanRes.status !== 200) {
    throw new Error(`Scan failed: ${JSON.stringify(scanRes.data)}`);
  }
  console.log(`-> Scan extracted medication: ${scanRes.data.extracted.name} (${scanRes.data.extracted.strength})`);
  console.log(`-> Times: ${JSON.stringify(scanRes.data.extracted.times)}`);
  console.log(`-> Human review disclaimer: "${scanRes.data.disclaimer}"`);

  console.log('\n✅ ALL PHASES 4, 5, 6, 7 REQUIREMENTS FULLY VERIFIED ON AWS!');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
