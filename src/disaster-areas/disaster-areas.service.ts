import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateDisasterAreaDto } from './dto/create-disaster-area.dto';
import { UpdateDisasterAreaDto } from './dto/update-disaster-area.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisasterAreasService {
  constructor(private prisma: PrismaService) {}

  private geoJsonToEwkt(geoJson: any): string {
    if (geoJson.type !== 'Polygon') {
      throw new BadRequestException('Only Polygon GeoJSON is supported for disaster areas');
    }
    const rings = geoJson.coordinates.map((ring: number[][]) => {
      const points = ring.map((coord: number[]) => `${coord[0]} ${coord[1]}`).join(', ');
      return `(${points})`;
    });
    return `SRID=4326;POLYGON(${rings.join(', ')})`;
  }

  async create(createDisasterAreaDto: CreateDisasterAreaDto) {
    const disaster = await this.prisma.db.orm.public.Disaster.first({ id: createDisasterAreaDto.disasterId });
    if (!disaster) {
      throw new NotFoundException(`Disaster with ID ${createDisasterAreaDto.disasterId} not found`);
    }

    const areaEwkt = this.geoJsonToEwkt(createDisasterAreaDto.area);

    return this.prisma.db.orm.public.DisasterArea.create({
      disasterId: createDisasterAreaDto.disasterId,
      severity: createDisasterAreaDto.severity as any,
      population: createDisasterAreaDto.population,
      area: areaEwkt as any,
    });
  }

  async findAll(filters: { disasterId?: string }) {
    let query: any = this.prisma.db.orm.public.DisasterArea;
    if (filters.disasterId) {
      query = query.where({ disasterId: filters.disasterId });
    }
    return query.all();
  }

  async findOne(id: string) {
    const area = await this.prisma.db.orm.public.DisasterArea.first({ id });
    if (!area) {
      throw new NotFoundException(`DisasterArea with ID ${id} not found`);
    }
    return area;
  }

  async update(id: string, updateDisasterAreaDto: UpdateDisasterAreaDto) {
    const area = await this.findOne(id);
    const data: any = { ...updateDisasterAreaDto };
    
    if (updateDisasterAreaDto.area) {
      data.area = this.geoJsonToEwkt(updateDisasterAreaDto.area) as any;
    }

    const updated = await this.prisma.db.orm.public.DisasterArea.where({ id }).update(data);
    if (!updated) {
      throw new NotFoundException(`DisasterArea with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.db.orm.public.DisasterArea.where({ id }).delete();
    return { success: true };
  }

  async searchNearby(lon: number, lat: number, radius: number) {
    if (lon < -180 || lon > 180) throw new BadRequestException('Longitude out of bounds');
    if (lat < -90 || lat > 90) throw new BadRequestException('Latitude out of bounds');
    if (radius <= 0 || radius > 100000) throw new BadRequestException('Radius must be between 1 and 100000 meters');

    const pointWkt = `SRID=4326;POINT(${lon} ${lat})`;

    // Use raw SQL to find intersecting/nearby areas using geography for accurate distance
    const plan = (this.prisma.db as any).sql`
      SELECT id, "disasterId", severity, population, ST_AsGeoJSON(area) as area
      FROM "public"."disasterArea"
      WHERE ST_DWithin(area::geography, ST_GeomFromEWKT(${pointWkt})::geography, ${radius})
    `.returnsRow({
      id: 'pg/uuid@1',
      disasterId: 'pg/uuid@1',
      severity: 'pg/text@1',
      population: 'pg/int4@1',
      area: 'pg/text@1'
    }).build();

    const rows = await this.prisma.db.runtime().query(plan);
    return rows;
  }

  async checkIntersects(lon: number, lat: number) {
    if (lon < -180 || lon > 180) throw new BadRequestException('Longitude out of bounds');
    if (lat < -90 || lat > 90) throw new BadRequestException('Latitude out of bounds');

    const pointWkt = `SRID=4326;POINT(${lon} ${lat})`;

    const plan = (this.prisma.db as any).sql`
      SELECT id, "disasterId", severity, population, ST_AsGeoJSON(area) as area
      FROM "public"."disasterArea"
      WHERE ST_Intersects(area, ST_GeomFromEWKT(${pointWkt}))
    `.returnsRow({
      id: 'pg/uuid@1',
      disasterId: 'pg/uuid@1',
      severity: 'pg/text@1',
      population: 'pg/int4@1',
      area: 'pg/text@1'
    }).build();

    const rows = await this.prisma.db.runtime().query(plan);
    return rows;
  }
}
