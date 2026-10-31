import postgres from '@prisma/orm-postgres/runtime';
import contractJson from './src/prisma/contract.json';
import postgis from '@prisma/orm-extension-postgis/runtime';
import * as dotenv from 'dotenv';
import { SosService } from './src/sos/sos.service';
import { PrismaService } from './src/prisma/prisma.service';

dotenv.config();

const db = postgres<any>({
  contractJson,
  extensions: [postgis],
  url: process.env['DATABASE_URL'],
});

const prismaService = { db } as any;

async function main() {
    const sosService = new SosService(prismaService);

    // Get an existing user
    const user = await db.orm.public.User.first();
    if (!user) {
        console.log("No user found");
        return;
    }

    console.log("Using user: " + user.id as string);

    try {
      const sosEvent = await sosService.create(user.id as string, {
          latitude: 16.0544,
          longitude: 108.2022,
          adults: 2,
          children: 1,
          elderly: 0,
          condition: "Testing nearby",
          urgency: "HIGH" as any,
      });
      console.log("Created SOS Event:", sosEvent.eventId);
    } catch (e: any) {
      if (e.message?.includes('Duplicate')) {
        console.log("SOS already exists for user");
      } else {
        console.error(e);
      }
    }

    const rawSql = (db as any).raw.sql`
      SELECT id, "requesterId", "sosEventId", "peopleCount", urgency, description, status, "createdAt"::text, "updatedAt"::text,
             ST_X(location::geometry) as longitude,
             ST_Y(location::geometry) as latitude,
             ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(${108.2022}, ${16.0544}), 4326)::geography) as distance
      FROM "public"."rescueRequest"
      WHERE ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${108.2022}, ${16.0544}), 4326)::geography,
        ${50000}
      )
      ORDER BY distance ASC
      LIMIT 100
    `.returnsRow({
      id: 'pg/text@1',
      requesterId: 'pg/text@1',
      sosEventId: 'pg/text@1',
      peopleCount: 'pg/int4@1',
      urgency: 'pg/text@1',
      description: 'pg/text@1',
      status: 'pg/text@1',
      createdAt: 'pg/text@1',
      updatedAt: 'pg/text@1',
      longitude: 'pg/float8@1',
      latitude: 'pg/float8@1',
      distance: 'pg/float8@1'
    }).build();

    const results = await (db as any).runtime().query(rawSql);
    console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => db.close());
