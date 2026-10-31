const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  const resUser = await client.query('SELECT id, email, role FROM "user" WHERE role = \'USER\' LIMIT 1');
  const resRescuer = await client.query('SELECT id, email, role FROM "user" WHERE role = \'RESCUER\' LIMIT 1');
  console.log('USER:', resUser.rows);
  console.log('RESCUER:', resRescuer.rows);
  await client.end();
}
run().catch(console.error);
