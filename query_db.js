const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const reqs = await prisma.$queryRaw`SELECT id, status, ST_AsText(location) as loc FROM rescue_requests`;
  console.log(reqs);
}
main().then(() => prisma.$disconnect());
