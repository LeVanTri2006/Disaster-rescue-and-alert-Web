import { Global, Module } from '@nestjs/common';
import { FirebaseSosPublisher } from './firebase-sos.publisher';

@Global()
@Module({
  providers: [FirebaseSosPublisher],
  exports: [FirebaseSosPublisher],
})
export class FirebaseModule {}
