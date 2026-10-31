import 'temporal-polyfill/global';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const requiredEnvs = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  for (const env of requiredEnvs) {
    if (!process.env[env]) {
      console.error(`FATAL ERROR: Environment variable ${env} is required but not set.`);
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
