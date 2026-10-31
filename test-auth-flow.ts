import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import request from 'supertest';

async function run() {
  const app = await NestFactory.create(AppModule);
  await app.init();

  const uniqueEmail = `testflow_${Date.now()}@example.com`;

  console.log('1. Registering user...');
  const regRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: uniqueEmail,
      password: 'Password123!',
      fullName: 'Flow Tester'
    });
    
  console.log('Register response status:', regRes.status);
  
  if (!regRes.body.data || !regRes.body.data.accessToken) {
    console.error('Failed to get access token from register!');
    process.exit(1);
  }
  
  const token = regRes.body.data.accessToken;
  
  console.log('\n2. Updating role...');
  const roleRes = await request(app.getHttpServer())
    .patch('/users/me/role')
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'RESCUER' });
    
  console.log('Update role response status:', roleRes.status);
  if (roleRes.status === 401) {
    console.error('Unauthorized! The token from register did not work!');
  } else {
    console.log('Success! The token worked.');
  }
  
  await app.close();
}

run().catch(console.error);
