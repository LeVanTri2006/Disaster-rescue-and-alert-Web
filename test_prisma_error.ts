import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  const requestId = 'abbd8b11-eb96-44c6-81d1-18af857abdbc';
  
  const rawSql = (prisma as any).raw ? (prisma as any).raw.sql`
      UPDATE "public"."rescueRequest"
      SET status = 'IN_PROGRESS'::"public"."RescueRequestStatus",
          "updatedAt" = NOW()
      WHERE id = ${requestId} AND status = 'PENDING'::"public"."RescueRequestStatus"
      RETURNING id::text, "requesterId"::text, status::text;
    ` : null;
    
  if (!rawSql) {
    console.log("No raw on PrismaClient. Trying to use $queryRawUnsafe");
    try {
        await prisma.$queryRawUnsafe(`
          UPDATE "public"."rescueRequest"
          SET status = 'IN_PROGRESS'::"public"."RescueRequestStatus",
              "updatedAt" = NOW()
          WHERE id = $1 AND status = 'PENDING'::"public"."RescueRequestStatus"
          RETURNING id::text, "requesterId"::text, status::text;
        `, requestId);
    } catch (e) {
        console.log("Exception name:", e.name);
        console.log("Error code:", e.code);
        console.log("Message:", e.message);
    }
  }
}
run();
