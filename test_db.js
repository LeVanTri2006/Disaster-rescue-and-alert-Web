const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public'
  });
  await client.connect();
  const res = await client.query('SELECT id, email, role, password FROM "User" LIMIT 5');
  console.log(res.rows);
  await client.end();
}
run().catch(console.error);
