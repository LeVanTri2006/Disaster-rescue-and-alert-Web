import { PrismaService } from './src/prisma/prisma.service';
const prisma = new PrismaService();
async function run() {
  try {
    const rawSql = (prisma.db as any).raw.sql`SELECT * FROM "public"."sOSEvent" LIMIT 1`.returnsRow({}).build();
    await prisma.db.runtime().query(rawSql);
    console.log('SUCCESS sOSEvent');
  } catch (e) {
    console.log('FAILED sOSEvent', (e as any).message);
  }
  prisma.onModuleDestroy();
}
run();
