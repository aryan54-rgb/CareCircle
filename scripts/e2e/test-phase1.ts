/**
 * Integration Test for Phase 1 against live deployed API Gateway
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
  console.log(`Starting Phase 1 Live Verification against ${API_URL}...\n`);

  // 1. Create Circle
  const testId = Date.now().toString(36);
  const caretakerEmail = `caretaker_${testId}@test.com`;
  const caretakerPasscode = 'caretaker123';

  console.log('1. Creating Circle (Owner: Caretaker)...');
  const createCircleRes = await request('/auth/circles', {
    method: 'POST',
    body: JSON.stringify({
      name: `Kalyan Family Circle ${testId}`,
      elderName: 'Grandmother Shanti',
      caretakerName: 'Son Rajesh',
      caretakerEmail,
      caretakerPasscode,
      timezone: 'Asia/Kolkata',
    }),
  });

  if (createCircleRes.status !== 200) {
    throw new Error(`Failed to create circle: ${JSON.stringify(createCircleRes.data)}`);
  }

  const caretakerToken = createCircleRes.data.token;
  const circleId = createCircleRes.data.circleId;
  console.log(`-> Circle created: circleId=${circleId}, token obtained.`);

  // 2. Generate Invite for ELDER
  console.log('\n2. Generating Invite for ELDER...');
  const elderInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'ELDER' }),
  });

  if (elderInviteRes.status !== 200) {
    throw new Error(`Failed to create invite: ${JSON.stringify(elderInviteRes.data)}`);
  }

  const elderInviteCode = elderInviteRes.data.code;
  console.log(`-> Elder invite code: ${elderInviteCode}`);

  // 3. Join as ELDER
  console.log('\n3. Joining Circle as ELDER...');
  const elderEmail = `elder_${testId}@test.com`;
  const elderPasscode = 'elder123';
  const elderJoinRes = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: elderInviteCode,
      name: 'Grandmother Shanti',
      email: elderEmail,
      passcode: elderPasscode,
    }),
  });

  if (elderJoinRes.status !== 200) {
    throw new Error(`Failed to join as elder: ${JSON.stringify(elderJoinRes.data)}`);
  }

  const elderToken = elderJoinRes.data.token;
  console.log(`-> Elder joined successfully: role=${elderJoinRes.data.member.role}`);

  // 4. Generate Invite for FAMILY
  console.log('\n4. Generating Invite for FAMILY...');
  const familyInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'FAMILY' }),
  });

  const familyInviteCode = familyInviteRes.data.code;
  console.log(`-> Family invite code: ${familyInviteCode}`);

  // 5. Join as FAMILY
  console.log('\n5. Joining Circle as FAMILY...');
  const familyEmail = `family_${testId}@test.com`;
  const familyPasscode = 'family123';
  const familyJoinRes = await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: familyInviteCode,
      name: 'Daughter Priya',
      email: familyEmail,
      passcode: familyPasscode,
    }),
  });

  const familyToken = familyJoinRes.data.token;
  console.log(`-> Family joined successfully: role=${familyJoinRes.data.member.role}`);

  // 6. Test Login for all 3 roles
  console.log('\n6. Testing Login for all 3 roles...');
  for (const [role, email, passcode] of [
    ['CARETAKER', caretakerEmail, caretakerPasscode],
    ['ELDER', elderEmail, elderPasscode],
    ['FAMILY', familyEmail, familyPasscode],
  ]) {
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, passcode }),
    });
    if (loginRes.status !== 200 || loginRes.data.member.role !== role) {
      throw new Error(`Login failed for ${role}: ${JSON.stringify(loginRes.data)}`);
    }
    console.log(`-> Logged in as ${role}: OK`);
  }

  // 7. Verify Role Permissions (Family cannot create invites)
  console.log('\n7. Testing Role Permissions (Family cannot create invites)...');
  const forbiddenInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${familyToken}` },
    body: JSON.stringify({ role: 'FAMILY' }),
  });
  if (forbiddenInviteRes.status === 403) {
    console.log('-> Family blocked from creating invites with 403: OK');
  } else {
    throw new Error(`Expected 403, got ${forbiddenInviteRes.status}`);
  }

  // 8. Test 5 wrong passcodes lockout
  console.log('\n8. Testing 5-failure account lockout...');
  const wrongEmail = `wrong_${testId}@test.com`;
  // First join with a real account to lock
  const lockInviteRes = await request('/circle/invites', {
    method: 'POST',
    headers: { Authorization: `Bearer ${caretakerToken}` },
    body: JSON.stringify({ role: 'FAMILY' }),
  });
  await request('/auth/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode: lockInviteRes.data.code,
      name: 'Lock Test',
      email: wrongEmail,
      passcode: 'correctPass123',
    }),
  });

  for (let i = 1; i <= 4; i++) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: wrongEmail, passcode: 'badpass' }),
    });
    console.log(`-> Failed attempt ${i}: status ${res.status}`);
  }

  // 5th attempt
  const fifthRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: wrongEmail, passcode: 'badpass' }),
  });
  console.log(`-> Failed attempt 5: status ${fifthRes.status} (${fifthRes.data.error.code})`);

  // 6th attempt should be 429 ACCOUNT_LOCKED
  const lockedRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: wrongEmail, passcode: 'correctPass123' }),
  });
  console.log(`-> Attempt after 5 failures: status ${lockedRes.status} (${lockedRes.data.error.code})`);
  if (lockedRes.status !== 429) {
    throw new Error(`Expected 429 ACCOUNT_LOCKED, got ${lockedRes.status}`);
  }
  console.log('-> Account lockout successfully verified: OK');

  // 9. Verify GET /circle and GET /activity
  console.log('\n9. Testing GET /circle & GET /activity...');
  const circleRes = await request('/circle', {
    headers: { Authorization: `Bearer ${caretakerToken}` },
  });
  console.log(`-> Members count: ${circleRes.data.members.length}`);

  const activityRes = await request('/activity', {
    headers: { Authorization: `Bearer ${elderToken}` },
  });
  console.log(`-> Recent activities logged: ${activityRes.data.activities.length}`);

  console.log('\n✅ ALL PHASE 1 REQUIREMENTS FULLY VERIFIED!');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
