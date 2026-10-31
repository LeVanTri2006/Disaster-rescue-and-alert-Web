import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWarningDto } from './dto/create-warning.dto';
import { UpdateWarningDto } from './dto/update-warning.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Severity } from '../common/enums/disaster.enum';
import { or } from '@prisma/orm-postgres/orm-client';

@Injectable()
export class WarningsService {
  constructor(private prisma: PrismaService) {}

  async create(createWarningDto: CreateWarningDto) {
    // Check if disaster exists
    const disaster = await this.prisma.db.orm.public.Disaster.first({ id: createWarningDto.disasterId });
    if (!disaster) {
      throw new NotFoundException(`Disaster with ID ${createWarningDto.disasterId} not found`);
    }

    return this.prisma.db.orm.public.Warning.create({
      ...createWarningDto,
      severity: createWarningDto.severity as any,
      expiresAt: createWarningDto.expiresAt ? new Date(createWarningDto.expiresAt) : undefined,
    });
  }

  async findAll(filters: { severity?: Severity; disasterId?: string; active?: boolean }) {
    let query: any = this.prisma.db.orm.public.Warning;

    if (filters.severity) {
      query = query.where({ severity: filters.severity });
    }
    if (filters.disasterId) {
      query = query.where({ disasterId: filters.disasterId });
    }
    if (filters.active !== undefined) {
      const now = new Date();
      if (filters.active) {
        // active means expiresAt > now OR expiresAt is null
        query = query.where((w: any, fns: any) => 
          or(
            fns.gt(w.expiresAt, now),
            fns.isNull(w.expiresAt)
          )
        );
      } else {
        // inactive means expiresAt <= now
        query = query.where((w: any, fns: any) => fns.lte(w.expiresAt, now));
      }
    }

    return query.orderBy((w: any) => w.issuedAt.desc()).all();
  }

  async findOne(id: string) {
    const warning = await this.prisma.db.orm.public.Warning.first({ id });
    if (!warning) {
      throw new NotFoundException(`Warning with ID ${id} not found`);
    }
    return warning;
  }

  async update(id: string, updateWarningDto: UpdateWarningDto) {
    const warning = await this.findOne(id);

    if (updateWarningDto.disasterId && updateWarningDto.disasterId !== warning.disasterId) {
      const disaster = await this.prisma.db.orm.public.Disaster.first({ id: updateWarningDto.disasterId });
      if (!disaster) {
        throw new NotFoundException(`Disaster with ID ${updateWarningDto.disasterId} not found`);
      }
    }

    const data: any = { ...updateWarningDto };
    if (updateWarningDto.expiresAt) data.expiresAt = new Date(updateWarningDto.expiresAt);

    const updated = await this.prisma.db.orm.public.Warning.where({ id }).update(data);
    
    if (!updated) {
      throw new NotFoundException(`Warning with ID ${id} not found`);
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.db.orm.public.Warning.where({ id }).delete();
    return { success: true };
  }
}
