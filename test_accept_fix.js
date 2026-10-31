const jwt = require('jsonwebtoken');
const secret = 'development_access_secret_key_123!';

const userPayload = { sub: 'f16abed5-ae5e-40fe-adf0-4e47544427e8', email: 'test@example.com', role: 'USER' };
const rescuerPayload = { sub: '4b49bb9d-45f0-434a-a5c3-8830cbc38947', email: 'testflow_1789659155408@example.com', role: 'RESCUER' };
const userToken = jwt.sign(userPayload, secret);
const rescuerToken = jwt.sign(rescuerPayload, secret);

async function run() {
  const { Client } = require('pg');
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  
  // Clean up any old active SOS so we can create a new one
  await client.query(`UPDATE "sOSEvent" SET status = 'RESOLVED' WHERE "userId" = $1`, [userPayload.sub]);
  await client.query(`UPDATE "rescueRequest" SET status = 'RESOLVED' WHERE "requesterId" = $1`, [userPayload.sub]);

  console.log('1. Creating new SOS event...');
  const sosRes = await fetch('http://localhost:3000/sos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
    body: JSON.stringify({ latitude: 10.7769, longitude: 106.7009, condition: 'Help needed', adults: 1, children: 0, elderly: 0, photos: [] })
  });
  const sosData = await sosRes.json();
  const sosEventId = sosData.data.eventId;
  
  const reqRes = await client.query(`SELECT id, status FROM "rescueRequest" WHERE "sosEventId" = $1`, [sosEventId]);
  const requestId = reqRes.rows[0].id;
  console.log(`RescueRequest Created: ID=${requestId}, status=${reqRes.rows[0].status}`);

  console.log('2. Accepting Mission...');
  const acceptRes = await fetch(`http://localhost:3000/rescue-missions/accept/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rescuerToken}` }
  });
  const acceptText = await acceptRes.json();
  console.log('HTTP Status:', acceptRes.status);
  console.log('Accept Response:', acceptText);

  console.log('3. Checking DB status...');
  const reqCheck = await client.query(`SELECT status FROM "rescueRequest" WHERE id = $1`, [requestId]);
  console.log(`RescueRequest Status after accept: ${reqCheck.rows[0].status}`);

  const missionCheck = await client.query(`SELECT id, status FROM "rescueMission" WHERE "requestId" = $1`, [requestId]);
  console.log(`RescueMission Created: count=${missionCheck.rows.length}, status=${missionCheck.rows[0]?.status}`);

  console.log('4. Duplicate accept...');
  const dupRes = await fetch(`http://localhost:3000/rescue-missions/accept/${requestId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rescuerToken}` }
  });
  console.log('Duplicate Accept HTTP Status:', dupRes.status);
  
  console.log('5. Invalid request ID...');
  const invalidRes = await fetch(`http://localhost:3000/rescue-missions/accept/00000000-0000-0000-0000-000000000000`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rescuerToken}` }
  });
  console.log('Invalid Accept HTTP Status:', invalidRes.status);

  await client.end();
}
run().catch(console.error);
