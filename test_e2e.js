const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken'); // Need to see how JWT is signed in backend

async function run() {
  // Find a user
  const user = await prisma.user.findFirst({ where: { role: 'USER' } });
  // Find a rescuer
  const rescuer = await prisma.user.findFirst({ where: { role: 'RESCUER' } });
  console.log('USER:', user.email, 'RESCUER:', rescuer.email);
}
run().catch(console.error).finally(() => prisma.$disconnect());
