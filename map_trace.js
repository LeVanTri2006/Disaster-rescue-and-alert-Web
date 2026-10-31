const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/canh_bao_thien_tai?schema=public'
});

async function main() {
  await client.connect();

  const lat = 16.0544;
  const lon = 108.2022;
  const radius = 50000;

  // 1. /sos/active
  // Usually this returns all active SOS, wait let me check backend sos.service.ts
  const sosResult = await client.query(`SELECT id, status, "createdAt" FROM "sOSEvent" WHERE status = 'ACTIVE'`);
  console.log("SOS Active Count:", sosResult.rows.length);
  const sosIds = sosResult.rows.map(r => r.id);
  //console.log("SOS Active IDs:", sosIds);

  // 2. /rescue-requests/nearby (raw count)
  const allReqResult = await client.query(`
    SELECT id, status 
    FROM "rescueRequest" 
    WHERE ST_DWithin(
      location::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )`, [lon, lat, radius]);
  console.log("Rescue Requests Nearby Raw Count:", allReqResult.rows.length);

  // 3. Rescue requests PENDING
  const pendingReqResult = await client.query(`
    SELECT id, status 
    FROM "rescueRequest" 
    WHERE status = 'PENDING' AND ST_DWithin(
      location::geography,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
      $3
    )`, [lon, lat, radius]);
  console.log("Rescue Requests Nearby PENDING Count:", pendingReqResult.rows.length);
  const reqIds = pendingReqResult.rows.map(r => r.id);
  //console.log("PENDING Request IDs:", reqIds);

  // Check if any SOS has corresponding rescue request. Wait, does `sOSEvent` have a relation? The schema shows no direct relation between `SOSEvent` and `RescueRequest`.
  // Wait, let's check if they have the same creator or same location.
  
  await client.end();
}

main().catch(console.error);
