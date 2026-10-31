import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileVerificationStatus } from '../../users/enums/profile-verification-status.enum';

@Injectable()
export class RescueProfilesService {
  private readonly logger = new Logger(RescueProfilesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPendingProfiles() {
    const profiles = await this.prisma.db.orm.public.RescueProfile
      .where({ verificationStatus: ProfileVerificationStatus.PENDING })
      .include('user')
      .all();
    
    return profiles.map(profile => {
      const { password, ...userWithoutPassword } = (profile as any).user || {};
      return {
        ...profile,
        user: userWithoutPassword
      };
    });
  }

  async getProfileById(id: string) {
    const profile = await this.prisma.db.orm.public.RescueProfile
      .where({ id })
      .include('user')
      .first();

    if (!profile) {
      throw new NotFoundException('Rescue profile not found');
    }

    const { password, ...userWithoutPassword } = (profile as any).user || {};
    return {
      ...profile,
      user: userWithoutPassword
    };
  }

  async updateVerification(id: string, status: ProfileVerificationStatus, adminId: string) {
    if (status !== ProfileVerificationStatus.APPROVED && status !== ProfileVerificationStatus.REJECTED) {
      throw new BadRequestException('Invalid verification status');
    }

    const profile = await this.prisma.db.orm.public.RescueProfile.where({ id }).first();
    if (!profile) {
      throw new NotFoundException('Rescue profile not found');
    }

    const updatedProfile = await this.prisma.db.orm.public.RescueProfile
      .where({ id })
      .update({
        verificationStatus: status as any,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any
      });

    this.logger.log(`Admin/Moderator ${adminId} updated verification status of rescue profile ${id} to ${status}`);

    return updatedProfile;
  }
}
