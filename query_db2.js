const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public'
});
client.connect().then(async () => {
  const reqs = await client.query(`SELECT id, "requesterId", status, description, ST_AsText(location) as loc, "createdAt" FROM "rescueRequest" WHERE description ILIKE '%Flood is rising very fast%'`);
  console.log("Rescue Requests:", reqs.rows);
  
  if (reqs.rows.length > 0) {
      const missions = await client.query(`SELECT id, "requestId", "rescuerId", status FROM "rescueMission" WHERE "requestId" = $1`, [reqs.rows[0].id]);
      console.log("Missions:", missions.rows);
  }

  const sos = await client.query(`SELECT id, "userId", status, message, ST_AsText(location) as loc, "createdAt" FROM "sOSEvent" WHERE message ILIKE '%Flood is rising very fast%'`);
  console.log("SOS Events:", sos.rows);
  
  process.exit(0);
});
