import { PrismaService } from './src/prisma/prisma.service';

async function bootstrap() {
  const prisma = new PrismaService();
  
  try {
    const list = await prisma.db.orm.public.RescueRequest.all();
    console.log("Found requests:", list.length);
    
    if (list.length > 0) {
        const id = list[0].id;
        console.log("Trying to find one with id", id);
        
        try {
            const req = await prisma.db.orm.public.RescueRequest.first({ id });
            console.log("Found first({id}):", req?.id);
        } catch (e) {
            console.log("Failed first({id}):", e);
        }
        
        try {
            const req2 = await prisma.db.orm.public.RescueRequest.where({ id }).first();
            console.log("Found with where({id}):", req2?.id);
        } catch (e) {
            console.log("Failed where({id}).first():", e);
        }
    }
  } catch (e) {
    console.error("Error:", e);
  }
  
  await prisma.db.close();
}
bootstrap();
