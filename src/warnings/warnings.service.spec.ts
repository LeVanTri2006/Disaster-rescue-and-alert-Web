import { Test, TestingModule } from '@nestjs/testing';
import { WarningsService } from './warnings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Severity } from '../common/enums/disaster.enum';

describe('WarningsService', () => {
  let service: WarningsService;
  let prisma: PrismaService;

  const mockWarning = {
    id: '1',
    disasterId: 'd1',
    title: 'Test Warning',
    message: 'Test Message',
    severity: Severity.HIGH,
    issuedAt: new Date(),
    expiresAt: null,
  };

  const mockDisaster = { id: 'd1' };

  const mockWarningModel = {
    create: jest.fn().mockResolvedValue(mockWarning),
    first: jest.fn().mockResolvedValue(mockWarning),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(mockWarning),
    delete: jest.fn().mockResolvedValue({}),
    orderBy: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue([mockWarning]),
  };

  const mockDisasterModel = {
    first: jest.fn().mockResolvedValue(mockDisaster),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          Warning: mockWarningModel,
          Disaster: mockDisasterModel,
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarningsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WarningsService>(WarningsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a warning', async () => {
    const dto = {
      disasterId: 'd1',
      title: 'Test Warning',
      message: 'Test Message',
      severity: Severity.HIGH,
    };
    const result = await service.create(dto);
    expect(result).toEqual(mockWarning);
    expect(mockWarningModel.create).toHaveBeenCalled();
  });

  it('should throw if creating for non-existent disaster', async () => {
    mockDisasterModel.first.mockResolvedValueOnce(null);
    await expect(service.create({ disasterId: 'invalid', title: 't', message: 'm', severity: Severity.LOW })).rejects.toThrow(NotFoundException);
  });

  it('should return all warnings', async () => {
    const result = await service.findAll({});
    expect(result).toEqual([mockWarning]);
    expect(mockWarningModel.all).toHaveBeenCalled();
  });

  it('should find one warning', async () => {
    const result = await service.findOne('1');
    expect(result).toEqual(mockWarning);
    expect(mockWarningModel.first).toHaveBeenCalledWith({ id: '1' });
  });

  it('should throw NotFoundException if warning not found', async () => {
    mockWarningModel.first.mockResolvedValueOnce(null);
    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('should update a warning', async () => {
    const result = await service.update('1', { title: 'Updated' });
    expect(result).toEqual(mockWarning);
    expect(mockWarningModel.update).toHaveBeenCalled();
  });

  it('should remove a warning', async () => {
    const result = await service.remove('1');
    expect(result).toEqual({ success: true });
    expect(mockWarningModel.delete).toHaveBeenCalled();
  });
});
