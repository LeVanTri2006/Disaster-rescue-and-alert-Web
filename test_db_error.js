const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public' });
  await client.connect();
  try {
    const res = await client.query(`
      UPDATE "public"."rescueRequest"
      SET status = 'IN_PROGRESS'::"public"."RescueRequestStatus",
          "updatedAt" = NOW()
      WHERE id = 'abbd8b11-eb96-44c6-81d1-18af857abdbc' AND status = 'PENDING'::"public"."RescueRequestStatus"
      RETURNING id::text, "requesterId"::text, status::text;
    `);
    console.log(res.rows);
  } catch (err) {
    console.error('ERROR:', err);
  }
  await client.end();
}
run();
