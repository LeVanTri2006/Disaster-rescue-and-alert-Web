const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  await client.query('UPDATE "rescueProfile" SET "verificationStatus" = \'APPROVED\' WHERE "userId" = \'4b49bb9d-45f0-434a-a5c3-8830cbc38947\'');
  await client.end();
}
run().catch(console.error);
