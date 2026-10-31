import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { RescueRequestsService } from './src/rescue-requests/rescue-requests.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(RescueRequestsService);
  
  try {
    console.log('Testing findAll...');
    const resultAll = await service.findAll({});
    console.log('findAll success:', resultAll.data.length);
  } catch (err) {
    console.error('findAll failed:', err);
  }

  try {
    console.log('Testing findNearby...');
    // 21.0, 105.0, 1000
    const resultNearby = await service.findNearby(21.0, 105.0, 1000);
    console.log('findNearby success:', resultNearby.length);
  } catch (err) {
    console.error('findNearby failed:', err);
  }

  await app.close();
}

bootstrap();
