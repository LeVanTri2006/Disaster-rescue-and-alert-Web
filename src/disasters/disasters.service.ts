import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateDisasterDto } from './dto/create-disaster.dto';
import { UpdateDisasterDto } from './dto/update-disaster.dto';
import { PrismaService } from '../prisma/prisma.service';
import { DisasterType, Severity, DisasterStatus } from '../common/enums/disaster.enum';

@Injectable()
export class DisastersService {
  constructor(private prisma: PrismaService) {}

  async create(createDisasterDto: CreateDisasterDto) {
    return this.prisma.db.orm.public.Disaster.create({
      ...createDisasterDto,
      type: createDisasterDto.type as any,
      severity: createDisasterDto.severity as any,
      status: createDisasterDto.status as any,
      startTime: createDisasterDto.startTime ? new Date(createDisasterDto.startTime) : undefined,
      endTime: createDisasterDto.endTime ? new Date(createDisasterDto.endTime) : undefined,
    });
  }

  async findAll(filters: { type?: DisasterType; severity?: Severity; status?: DisasterStatus }) {
    let query: any = this.prisma.db.orm.public.Disaster;
    
    if (filters.type) {
      query = query.where({ type: filters.type });
    }
    if (filters.severity) {
      query = query.where({ severity: filters.severity });
    }
    if (filters.status) {
      query = query.where({ status: filters.status });
    }

    return query.orderBy((d: any) => d.createdAt.desc()).all();
  }

  async findOne(id: string) {
    const disaster = await this.prisma.db.orm.public.Disaster.first({ id });
    if (!disaster) {
      throw new NotFoundException(`Disaster with ID ${id} not found`);
    }
    return disaster;
  }

  async update(id: string, updateDisasterDto: UpdateDisasterDto) {
    const disaster = await this.findOne(id);
    
    const data: any = { ...updateDisasterDto };
    
    // Convert date strings to Date objects if present
    if (updateDisasterDto.startTime) data.startTime = new Date(updateDisasterDto.startTime);
    if (updateDisasterDto.endTime) data.endTime = new Date(updateDisasterDto.endTime);

    const updated = await this.prisma.db.orm.public.Disaster.where({ id }).update(data);
    
    if (!updated) {
      throw new NotFoundException(`Disaster with ID ${id} not found`);
    }

    return updated;
  }

  async remove(id: string) {
    const disaster = await this.findOne(id);
    await this.prisma.db.orm.public.Disaster.where({ id }).delete();
    return { success: true };
  }
}
