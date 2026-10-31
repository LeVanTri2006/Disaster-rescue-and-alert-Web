import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from './enums/user-role.enum';
import { UserStatus } from './enums/user-status.enum';

export type CreateUserParams = {
  fullName: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  firebaseUid?: string;
};

export type UpdateUserParams = {
  fullName?: string;
  avatar?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserParams) {
    const roleToSet = data.role || UserRole.USER;
    const user = await this.prisma.db.orm.public.User.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: roleToSet as any,
      status: data.status as any || 'ACTIVE',
      firebaseUid: data.firebaseUid,
    });

    if (roleToSet === UserRole.RESCUER) {
      await this.prisma.db.orm.public.RescueProfile.create({
        userId: user.id,
        verificationStatus: 'PENDING' as any,
        skills: [],
      });
    }

    return this.excludePassword(user);
  }

  async findById(id: string) {
    const user = await this.prisma.db.orm.public.User.where({ id }).include('rescueProfile').first();
    if (!user) return null;
    return this.excludePassword(user);
  }

  async findByEmail(email: string) {
    // Return with password for auth verification
    return this.prisma.db.orm.public.User.first({ email });
  }

  async findByPhone(phone: string) {
    // Return with password for auth verification
    return this.prisma.db.orm.public.User.first({ phone });
  }

  async findByFirebaseUid(firebaseUid: string) {
    return this.prisma.db.orm.public.User.first({ firebaseUid });
  }

  async linkFirebaseUid(id: string, firebaseUid: string) {
    const updatedUser = await this.prisma.db.orm.public.User
      .where({ id })
      .update({ firebaseUid, updatedAt: (globalThis as any).Temporal.Now.instant() as any });
    if (!updatedUser) throw new NotFoundException('Failed to link firebaseUid');
    return this.excludePassword(updatedUser);
  }

  async update(id: string, data: UpdateUserParams) {
    const user = await this.prisma.db.orm.public.User.first({ id });
    if (!user) throw new NotFoundException('User not found');

    const updatedUser = await this.prisma.db.orm.public.User
      .where({ id })
      .update({
        fullName: data.fullName,
        avatar: data.avatar,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any,
      });
    
    if (!updatedUser) throw new NotFoundException('Failed to update user');
    return this.excludePassword(updatedUser);
  }

  async updateRole(id: string, role: UserRole) {
    const user = await this.prisma.db.orm.public.User.first({ id });
    if (!user) throw new NotFoundException('User not found');

    // Only allow updating to USER or RESCUER
    if (role !== UserRole.USER && role !== UserRole.RESCUER) {
      throw new BadRequestException('Invalid role selected');
    }

    const updatedUser = await this.prisma.db.orm.public.User
      .where({ id })
      .update({
        role: role as any,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any,
      });
    
    if (!updatedUser) throw new NotFoundException('Failed to update user role');

    // Handle RESCUER verification flow
    if (role === UserRole.RESCUER) {
      const existingProfile = await this.prisma.db.orm.public.RescueProfile.first({ userId: id });
      if (!existingProfile) {
        await this.prisma.db.orm.public.RescueProfile.create({
          userId: id,
          verificationStatus: 'PENDING' as any,
          skills: [],
        });
      }
    }

    return this.excludePassword(updatedUser);
  }

  async setResetOtp(id: string, otp: string, expiresAt: any) {
    const updatedUser = await this.prisma.db.orm.public.User
      .where({ id })
      .update({
        resetPasswordOtp: otp,
        resetPasswordExpiresAt: expiresAt,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any,
      });
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  async clearResetOtp(id: string) {
    const updatedUser = await this.prisma.db.orm.public.User
      .where({ id })
      .update({
        resetPasswordOtp: null,
        resetPasswordExpiresAt: null,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any,
      });
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  async updatePassword(id: string, passwordHash: string) {
    const updatedUser = await this.prisma.db.orm.public.User
      .where({ id })
      .update({
        password: passwordHash,
        resetPasswordOtp: null,
        resetPasswordExpiresAt: null,
        updatedAt: (globalThis as any).Temporal.Now.instant() as any,
      });
    if (!updatedUser) throw new NotFoundException('User not found');
    return updatedUser;
  }

  excludePassword<T extends { password?: string | null }>(user: T): Omit<T, 'password'> {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
