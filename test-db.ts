import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const sos = await prisma.sOSEvent.findFirst();
  console.log(sos);
}
main();
