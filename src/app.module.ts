import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DisastersModule } from './disasters/disasters.module';
import { WarningsModule } from './warnings/warnings.module';
import { DisasterAreasModule } from './disaster-areas/disaster-areas.module';
import { RescueRequestsModule } from './rescue-requests/rescue-requests.module';
import { RescueMissionsModule } from './rescue-missions/rescue-missions.module';
import { RescueTeamsModule } from './rescue-teams/rescue-teams.module';
import { SosModule } from './sos/sos.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    HealthModule,
    PrismaModule, 
    UsersModule, 
    AuthModule, 
    DisastersModule, 
    WarningsModule, 
    DisasterAreasModule,
    RescueRequestsModule,
    RescueMissionsModule,
    RescueTeamsModule,
    SosModule,
    FirebaseModule,
    AdminModule,
    MailModule,
  ],
})
export class AppModule {}
