import { db } from './src/prisma/db';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const list = await db.orm.public.RescueRequest.all();
    console.log("Found requests:", list.length);
    
    if (list.length > 0) {
        const id = list[0].id;
        console.log("Trying to find one with id", id);
        
        try {
            const req = await db.orm.public.RescueRequest.first({ id });
            console.log("Found first({id}):", req?.id);
        } catch (e) {
            console.log("Failed first({id}):", e);
        }
        
        try {
            const req2 = await db.orm.public.RescueRequest.where({ id }).first();
            console.log("Found with where({id}):", req2?.id);
        } catch (e) {
            console.log("Failed where({id}).first():", e);
        }
    }
  } catch (e) {
    console.error("Error:", e);
  }
  
  await app.close();
}
bootstrap();
