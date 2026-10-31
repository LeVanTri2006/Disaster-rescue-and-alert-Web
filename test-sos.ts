import { Test, TestingModule } from '@nestjs/testing';
import { SosService } from './src/sos/sos.service';
import { PrismaService } from './src/prisma/prisma.service';
import { FirebaseSosPublisher } from './src/firebase/firebase-sos.publisher';
import { Logger } from '@nestjs/common';
import { Severity } from './src/common/enums/disaster.enum';
import { randomUUID } from 'crypto';

async function runTest() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SosService,
      PrismaService,
      {
        provide: FirebaseSosPublisher,
        useValue: { publishSosEvent: () => Promise.resolve(true) }
      },
      Logger
    ],
  }).compile();
  await module.init();

  const sosService = module.get<SosService>(SosService);
  const prismaService = module.get<PrismaService>(PrismaService);
  
  // Create a dummy user
  const userId = randomUUID();
  await prismaService.db.orm.public.User.create({
    id: userId,
    firebaseUid: randomUUID(),
    email: `test-${userId}@example.com`,
    role: "USER", fullName: "Test User",
    status: 'ACTIVE',
  } as any);

  try {
    console.log('Testing NO PHOTO SOS...');
    const result1 = await sosService.create(userId, {
      adults: 1,
      children: 2,
      elderly: 0,
      condition: 'Flood',
      description: 'Help no photo',
      latitude: 16.0544,
      longitude: 108.2022,
      urgency: Severity.HIGH,
    });
    
    console.log('Result 1 created:', result1.eventId);
    
    // verify db
    const req1 = await prismaService.db.orm.public.RescueRequest.where({ sosEventId: result1.eventId }).first();
    console.log('RescueRequest 1:', req1 ? { id: req1.id, status: req1.status, peopleCount: req1.peopleCount } : 'NULL');

    // clean up 1
    await prismaService.db.orm.public.SOSEvent.where({ id: result1.eventId }).update({ status: 'RESOLVED' });

    console.log('Testing SINGLE PHOTO SOS...');
    const result2 = await sosService.create(userId, {
      adults: 2,
      children: 0,
      elderly: 1,
      condition: 'Fire',
      description: 'Help single photo',
      latitude: 16.0544,
      longitude: 108.2022,
      urgency: Severity.CRITICAL,
      photoUrl: 'sos/dummy/1.jpg'
    });
    
    console.log('Result 2 created:', result2.eventId);
    const req2 = await prismaService.db.orm.public.RescueRequest.where({ sosEventId: result2.eventId }).first();
    
    console.log('RescueRequest 2:', req2 ? { id: req2.id, status: req2.status, peopleCount: req2.peopleCount } : 'NULL');
    

    await prismaService.db.orm.public.SOSEvent.where({ id: result2.eventId }).update({ status: 'RESOLVED' });

    console.log('Testing MULTI PHOTO SOS...');
    const result3 = await sosService.create(userId, {
      adults: 0,
      children: 0,
      elderly: 1,
      condition: 'Storm',
      description: 'Help multi photo',
      latitude: 16.0544,
      longitude: 108.2022,
      urgency: Severity.LOW,
      photos: ['sos/dummy/2.jpg', 'sos/dummy/3.jpg']
    });
    
    console.log('Result 3 created:', result3.eventId);
    const req3 = await prismaService.db.orm.public.RescueRequest.where({ sosEventId: result3.eventId }).first();
    
    console.log('RescueRequest 3:', req3 ? { id: req3.id, status: req3.status, peopleCount: req3.peopleCount } : 'NULL');
    
    
    // Testing duplicate
    console.log('Testing DUPLICATE...');
    try {
      await sosService.create(userId, {
        adults: 1,
        children: 0,
        elderly: 0,
        condition: 'Flood',
        latitude: 16.0544,
        longitude: 108.2022,
      });
      console.log('FAIL: Expected ConflictException');
    } catch (e: any) {
      console.log('Duplicate test passed:', e.message);
    }

  } finally {
    // clean up user
    await prismaService.db.orm.public.User.where({ id: userId }).delete();
  }
  
  await module.close();
}

runTest().catch(console.error);
