import { PrismaService } from './src/prisma/prisma.service';
const prisma = new PrismaService();
async function run() {
  try {
    const rawSql = (prisma.db as any).raw.sql`SELECT * FROM "public"."rescueRequest" LIMIT 1`.returnsRow({}).build();
    await prisma.db.runtime().query(rawSql);
    console.log('SUCCESS rescueRequest');
  } catch (e) {
    console.log('FAILED rescueRequest', (e as any).message);
  }
  prisma.onModuleDestroy();
}
run();
