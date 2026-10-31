import { PrismaService } from './src/prisma/prisma.service';
const prisma = new PrismaService();
console.log('db.sql exists?', typeof (prisma.db as any).sql);
console.log('db.raw exists?', typeof (prisma.db as any).raw);
if ((prisma.db as any).raw) {
  console.log('db.raw.sql exists?', typeof (prisma.db as any).raw.sql);
}
prisma.onModuleDestroy();
