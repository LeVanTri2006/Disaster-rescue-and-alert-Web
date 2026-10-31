const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public'
});

async function main() {
  await client.connect();

  const allReq = await client.query(`SELECT id, status FROM "rescueRequest"`);
  console.log("ALL Rescue Requests in DB:", allReq.rows.length);

  const allSos = await client.query(`SELECT id, status FROM "sOSEvent"`);
  console.log("ALL SOS Events in DB:", allSos.rows.length);

  await client.end();
}

main().catch(console.error);
