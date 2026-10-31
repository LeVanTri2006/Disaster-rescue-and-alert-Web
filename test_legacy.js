const jwt = require('jsonwebtoken');
const secret = 'development_access_secret_key_123!';
const rescuerPayload = { sub: '4b49bb9d-45f0-434a-a5c3-8830cbc38947', email: 'testflow_1789659155408@example.com', role: 'RESCUER' };
const rescuerToken = jwt.sign(rescuerPayload, secret);

async function run() {
  const acceptRes = await fetch(`http://localhost:3000/rescue-missions/accept/317c93ce-7878-41a7-9c35-15993b44977d`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rescuerToken}` }
  });
  const acceptText = await acceptRes.text();
  console.log('HTTP Status:', acceptRes.status);
  console.log('Accept Response:', acceptText);
}
run().catch(console.error);
