const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public'
});
client.connect().then(async () => {
  const res = await client.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexdef ILIKE '%gist%';");
  console.log(res.rows);
  process.exit(0);
});
