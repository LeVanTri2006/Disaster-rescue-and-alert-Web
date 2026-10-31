import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuthService } from './src/auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AuthService);
  
  try {
    const res = await authService.register({
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });
    console.log('Registered user:', res);
  } catch (e) {
    console.error('Error during register:', e);
  }
  
  await app.close();
}

bootstrap();
