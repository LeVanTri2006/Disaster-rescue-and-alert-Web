import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { RescueRequestsService } from './src/rescue-requests/rescue-requests.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(RescueRequestsService);
  
  try {
    const list = await service.findAll({});
    console.log("findAll:", list);
    
    if (list.data.length > 0) {
        const id = list.data[0].id;
        console.log("Trying to find one with id", id);
        const req = await service.findOne(id);
        console.log("Found:", req);
    }
  } catch (e) {
    console.error("Error:", e);
  }
  
  await app.close();
}
bootstrap();
