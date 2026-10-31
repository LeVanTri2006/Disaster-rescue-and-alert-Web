import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MissionStatus } from '../../common/enums/mission-status.enum';
import { RescueRequestStatus } from '../../common/enums/rescue-request.enum';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    // Fetch all in parallel
    const [
      allUsers,
      allMissions,
      allRequests,
      allSos,
      allDisasters,
      allWarnings,
      pendingProfiles,
    ] = await Promise.all([
      this.prisma.db.orm.public.User.where({} as any).all(),
      this.prisma.db.orm.public.RescueMission.where({} as any).all(),
      this.prisma.db.orm.public.RescueRequest.where({} as any).all(),
      this.prisma.db.orm.public.SOSEvent.where({} as any).all(),
      this.prisma.db.orm.public.Disaster.where({} as any).all(),
      this.prisma.db.orm.public.Warning.where({} as any).all(),
      this.prisma.db.orm.public.RescueProfile.where({ verificationStatus: 'PENDING' as any }).all(),
    ]);

    const rescuers = allUsers.filter((u: any) => u.role === 'RESCUER');
    const activeMissions = allMissions.filter((m: any) =>
      [MissionStatus.ASSIGNED, MissionStatus.IN_ROUTE, MissionStatus.IN_PROGRESS].includes(m.status)
    );
    const completedMissions = allMissions.filter((m: any) => m.status === MissionStatus.COMPLETED);
    const pendingRequests = allRequests.filter((r: any) => r.status === RescueRequestStatus.PENDING);
    const activeSos = allSos.filter((s: any) => s.status === 'ACTIVE');
    const activeDisasters = allDisasters.filter((d: any) => d.status === 'ACTIVE');
    const now = new Date();
    const activeWarnings = allWarnings.filter((w: any) => !w.expiresAt || new Date(w.expiresAt) > now);

    return {
      totalUsers: allUsers.length,
      totalRescuers: rescuers.length,
      pendingRescuers: pendingProfiles.length,
      pendingRequests: pendingRequests.length,
      activeMissions: activeMissions.length,
      completedMissions: completedMissions.length,
      activeSos: activeSos.length,
      activeDisasters: activeDisasters.length,
      activeWarnings: activeWarnings.length,
    };
  }
}
