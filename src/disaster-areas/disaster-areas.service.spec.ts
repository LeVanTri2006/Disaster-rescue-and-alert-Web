import { Test, TestingModule } from '@nestjs/testing';
import { DisasterAreasService } from './disaster-areas.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Severity } from '../common/enums/disaster.enum';

describe('DisasterAreasService', () => {
  let service: DisasterAreasService;
  let prisma: PrismaService;

  const mockDisasterArea = {
    id: '1',
    disasterId: 'd1',
    severity: Severity.HIGH,
    population: 1000,
    area: 'SRID=4326;POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))',
  };

  const mockDisasterModel = {
    first: jest.fn().mockResolvedValue({ id: 'd1' }),
  };

  const mockDisasterAreaModel = {
    create: jest.fn().mockResolvedValue(mockDisasterArea),
    first: jest.fn().mockResolvedValue(mockDisasterArea),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(mockDisasterArea),
    delete: jest.fn().mockResolvedValue({}),
    all: jest.fn().mockResolvedValue([mockDisasterArea]),
  };

  const mockRawQuery = jest.fn().mockResolvedValue([mockDisasterArea]);

  const mockPrismaService: any = {
    db: {
      orm: {
        public: {
          DisasterArea: mockDisasterAreaModel,
          Disaster: mockDisasterModel,
        },
      },
      raw: jest.fn(() => ({
        returnsRow: jest.fn(() => ({
          build: jest.fn(() => 'plan'),
        })),
      })),
      runtime: () => ({
        query: mockRawQuery,
      }),
    },
  };
  
  // mock raw sql function
  mockPrismaService.db.sql = jest.fn(() => ({
    returnsRow: jest.fn(() => ({
      build: jest.fn(() => 'plan'),
    })),
  }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisasterAreasService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DisasterAreasService>(DisasterAreasService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a disaster area', async () => {
    const dto = {
      disasterId: 'd1',
      severity: Severity.HIGH,
      area: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
      },
    };
    const result = await service.create(dto);
    expect(result).toEqual(mockDisasterArea);
    expect(mockDisasterAreaModel.create).toHaveBeenCalled();
  });

  it('should return all disaster areas', async () => {
    const result = await service.findAll({});
    expect(result).toEqual([mockDisasterArea]);
  });

  it('should find one disaster area', async () => {
    const result = await service.findOne('1');
    expect(result).toEqual(mockDisasterArea);
  });

  it('should update a disaster area', async () => {
    const result = await service.update('1', { population: 2000 });
    expect(result).toEqual(mockDisasterArea);
  });

  it('should remove a disaster area', async () => {
    const result = await service.remove('1');
    expect(result).toEqual({ success: true });
  });

  it('should search nearby', async () => {
    const result = await service.searchNearby(10, 20, 1000);
    expect(result).toEqual([mockDisasterArea]);
    expect(mockRawQuery).toHaveBeenCalledWith('plan');
  });

  it('should check intersects', async () => {
    const result = await service.checkIntersects(10, 20);
    expect(result).toEqual([mockDisasterArea]);
    expect(mockRawQuery).toHaveBeenCalledWith('plan');
  });
});
