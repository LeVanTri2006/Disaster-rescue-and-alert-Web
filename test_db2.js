const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log(res.rows);
  const users = await client.query('SELECT * FROM "users" LIMIT 2');
  console.log(users.rows);
  await client.end();
}
run().catch(console.error);
