const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  try {
    const res = await client.query(`SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'rescueRequest' AND column_name = 'status'`);
    console.log(res.rows);
  } catch (err) {
    console.error('ERROR:', err);
  }
  await client.end();
}
run();
