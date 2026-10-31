import { Test, TestingModule } from '@nestjs/testing';
import { DisastersService } from './disasters.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DisasterType, Severity, DisasterStatus } from '../common/enums/disaster.enum';

describe('DisastersService', () => {
  let service: DisastersService;
  let prisma: PrismaService;

  const mockDisaster = {
    id: '1',
    type: DisasterType.STORM,
    title: 'Test Storm',
    description: 'Test Description',
    severity: Severity.HIGH,
    status: DisasterStatus.ACTIVE,
    startTime: new Date(),
    endTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDisasterModel = {
    create: jest.fn().mockResolvedValue(mockDisaster),
    first: jest.fn().mockResolvedValue(mockDisaster),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(mockDisaster),
    delete: jest.fn().mockResolvedValue({}),
    orderBy: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue([mockDisaster]),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          Disaster: mockDisasterModel,
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisastersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DisastersService>(DisastersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a disaster', async () => {
    const dto = {
      type: DisasterType.STORM,
      title: 'Test Storm',
      severity: Severity.HIGH,
    };
    const result = await service.create(dto);
    expect(result).toEqual(mockDisaster);
    expect(mockDisasterModel.create).toHaveBeenCalled();
  });

  it('should return all disasters', async () => {
    const result = await service.findAll({});
    expect(result).toEqual([mockDisaster]);
    expect(mockDisasterModel.all).toHaveBeenCalled();
  });

  it('should find one disaster', async () => {
    const result = await service.findOne('1');
    expect(result).toEqual(mockDisaster);
    expect(mockDisasterModel.first).toHaveBeenCalledWith({ id: '1' });
  });

  it('should throw NotFoundException if disaster not found', async () => {
    mockDisasterModel.first.mockResolvedValueOnce(null);
    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('should update a disaster', async () => {
    const result = await service.update('1', { title: 'Updated' });
    expect(result).toEqual(mockDisaster);
    expect(mockDisasterModel.update).toHaveBeenCalled();
  });

  it('should remove a disaster', async () => {
    const result = await service.remove('1');
    expect(result).toEqual({ success: true });
    expect(mockDisasterModel.delete).toHaveBeenCalled();
  });
});
