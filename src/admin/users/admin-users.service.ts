import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UserStatus } from '../../users/enums/user-status.enum';
import { UserRole } from '../../users/enums/user-role.enum';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAdminUsersDto) {
    const { role, status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    let users = await this.prisma.db.orm.public.User.where({} as any).include('rescueProfile').all();

    // Filter in-memory (Prisma 8 ORM doesn't support complex AND/OR natively yet)
    if (role) {
      users = users.filter((u: any) => u.role === role);
    }
    if (status) {
      users = users.filter((u: any) => u.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      users = users.filter((u: any) =>
        (u.fullName && u.fullName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q))
      );
    }

    const total = users.length;
    const data = users.slice(skip, skip + limit).map((u: any) => {
      const { password, resetPasswordOtp, resetPasswordExpiresAt, ...safe } = u;
      return safe;
    });

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const user = await this.prisma.db.orm.public.User
      .where({ id })
      .include('rescueProfile')
      .first();

    if (!user) throw new NotFoundException('User not found');

    const { password, resetPasswordOtp, resetPasswordExpiresAt, ...safe } = user as any;
    return safe;
  }

  async updateStatus(id: string, status: UserStatus, requestingAdminId: string) {
    const user = await this.prisma.db.orm.public.User.where({ id }).first();
    if (!user) throw new NotFoundException('User not found');

    if (id === requestingAdminId) {
      throw new BadRequestException('Admin cannot change their own status');
    }

    const updated = await this.prisma.db.orm.public.User
      .where({ id })
      .update({
        status: status as any,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any,
      });

    const { password, resetPasswordOtp, resetPasswordExpiresAt, ...safe } = updated as any;
    return safe;
  }

  async findApprovedRescuers() {
    const profiles = await this.prisma.db.orm.public.RescueProfile
      .where({ verificationStatus: 'APPROVED' as any })
      .include('user')
      .all();

    return profiles
      .filter((p: any) => p.user && p.user.status === UserStatus.ACTIVE && p.user.role === UserRole.RESCUER)
      .map((p: any) => {
        const { password, resetPasswordOtp, resetPasswordExpiresAt, ...safeUser } = p.user || {};
        return { ...p, user: safeUser };
      });
  }
}
