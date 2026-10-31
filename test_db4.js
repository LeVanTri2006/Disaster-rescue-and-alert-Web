const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  const res = await client.query('SELECT "verificationStatus" FROM "rescueProfile" WHERE "userId" = \'4b49bb9d-45f0-434a-a5c3-8830cbc38947\'');
  console.log('RESCUER profile:', res.rows[0]);
  await client.end();
}
run().catch(console.error);
