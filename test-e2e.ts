import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();

    console.log("Creating Rescue Mission Data...");

    // 1. Get the rescuer user
    let rescuerRes = await client.query(`SELECT id, email FROM "public"."user" WHERE role = 'RESCUER' LIMIT 1`);
    
    if (rescuerRes.rowCount === 0) {
        console.log("No rescuer found. Converting the first user to RESCUER...");
        const anyUserRes = await client.query(`SELECT id FROM "public"."user" LIMIT 1`);
        if (anyUserRes.rowCount && anyUserRes.rowCount > 0) {
            await client.query(`UPDATE "public"."user" SET role = 'RESCUER' WHERE id = $1`, [anyUserRes.rows[0].id]);
            rescuerRes = await client.query(`SELECT id, email FROM "public"."user" WHERE role = 'RESCUER' LIMIT 1`);
        }
    }
    
    if (rescuerRes.rowCount === 0) {
        console.log("No user in the database. Please create a user first via the app.");
        await client.end();
        return;
    }
    
    const rescuer = rescuerRes.rows[0];

    // 2. Get a requester user
    let requesterRes = await client.query(`SELECT id, email FROM "public"."user" WHERE role = 'USER' LIMIT 1`);
    if (requesterRes.rowCount === 0) {
        requesterRes = rescuerRes; // fallback
    }
    const requester = requesterRes.rows[0];

    console.log(`Using Rescuer: ${rescuer.email}, Requester: ${requester.email}`);

    // 3. Create a Rescue Request
    const reqRes = await client.query(`
        INSERT INTO "public"."rescueRequest" ("id", "requesterId", "location", "peopleCount", "urgency", "description", "status", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, ST_SetSRID(ST_MakePoint(108.2022, 16.0544), 4326), 4, 'HIGH', 'Flood is rising very fast, need boat', 'ASSIGNED', now(), now())
        RETURNING id;
    `, [requester.id]);
    const requestId = reqRes.rows[0].id;

    console.log(`Created Rescue Request: ${requestId}`);

    // 4. Create a Rescue Mission assigned to this rescuer
    const missionRes = await client.query(`
        INSERT INTO "public"."rescueMission" ("id", "requestId", "rescuerId", "status")
        VALUES (gen_random_uuid(), $1, $2, 'ASSIGNED')
        RETURNING id;
    `, [requestId, rescuer.id]);
    const missionId = missionRes.rows[0].id;

    console.log(`Created Rescue Mission: ${missionId} for Rescuer: ${rescuer.email}`);

    await client.end();
}

main().catch(console.error);
