const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.rescueRequest.findMany({
    where: {
      description: {
        contains: 'Flood is rising very fast, need boat'
      }
    },
    include: {
      missions: true
    }
  });
  
  console.log("RescueRequests:", JSON.stringify(requests, null, 2));
  
  // also check if there is any SOSEvent with similar message or time
  const sos = await prisma.sOSEvent.findMany({
    where: {
      message: {
        contains: 'Flood is rising very fast'
      }
    }
  });
  
  console.log("SOSEvents with same message:", JSON.stringify(sos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
