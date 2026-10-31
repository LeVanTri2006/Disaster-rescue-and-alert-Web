import { Test, TestingModule } from '@nestjs/testing';
import { RescueRequestsService } from './rescue-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RescueRequestStatus } from '../common/enums/rescue-request.enum';
import { Severity } from '../common/enums/disaster.enum';

describe('RescueRequestsService', () => {
  let service: RescueRequestsService;
  let prisma: PrismaService;

  const mockRequest = {
    id: 'req-1',
    requesterId: 'user-1',
    peopleCount: 2,
    urgency: Severity.HIGH,
    description: 'Test Request',
    status: RescueRequestStatus.PENDING,
    location: 'geometry-placeholder',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueryBuilder = {
    first: jest.fn(),
    all: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockRescueRequestModel = {
    where: jest.fn().mockReturnValue(mockQueryBuilder),
    first: jest.fn(),
    all: jest.fn(),
  };

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          RescueRequest: mockRescueRequestModel,
        },
      },
      raw: {
        sql: jest.fn((strings: TemplateStringsArray, ...values: any[]) => ({
          returnsRow: jest.fn(() => ({ build: jest.fn().mockReturnValue('mock raw sql') })),
        })),
      },
      runtime: jest.fn().mockReturnValue({
        query: jest.fn().mockResolvedValue([mockRequest]),
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RescueRequestsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RescueRequestsService>(RescueRequestsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new rescue request when user has no active requests', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(null)
                            .mockResolvedValueOnce(null)
                            .mockResolvedValueOnce(null);

      const dto = {
        latitude: 10,
        longitude: 20,
        peopleCount: 1,
        urgency: Severity.HIGH,
      };

      const result = await service.create('user-1', dto);
      expect(result).toEqual(mockRequest);
      expect(prisma.db.runtime().query).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user has an active request', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce(mockRequest);

      const dto = {
        latitude: 10,
        longitude: 20,
        peopleCount: 1,
        urgency: Severity.HIGH,
      };

      await expect(service.create('user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all requests paginated', async () => {
      mockRescueRequestModel.all.mockResolvedValueOnce([mockRequest]);
      
      const result = await service.findAll({});
      expect(result.data).toEqual([mockRequest]);
      expect(result.total).toBe(1);
    });
  });

  describe('findNearby', () => {
    it('should execute raw spatial query for nearby requests', async () => {
      const result = await service.findNearby(10.0, 10.0, 5000);
      expect(result).toEqual([{
        ...mockRequest,
        location: {
          type: 'Point',
          coordinates: [undefined, undefined]
        }
      }]);
      expect(prisma.db.runtime().query).toHaveBeenCalled();
    });
    
    it('should reject invalid coordinates', async () => {
      await expect(service.findNearby(100.0, 200.0, 5000)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return request if exists', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce(mockRequest);
      const result = await service.findOne('req-1');
      expect(result).toEqual(mockRequest);
    });

    it('should throw NotFoundException if not exists', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce(null);
      await expect(service.findOne('req-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockRescueRequestModel.first.mockResolvedValue(mockRequest);
    });

    it('should update request if user is owner', async () => {
      mockQueryBuilder.update.mockResolvedValueOnce(mockRequest);
      const result = await service.update('req-1', 'user-1', false, { peopleCount: 5 });
      expect(result).toEqual(mockRequest);
    });

    it('should throw ForbiddenException if user is not owner and not admin', async () => {
      await expect(service.update('req-1', 'other-user', false, { peopleCount: 5 })).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to update any request', async () => {
      mockQueryBuilder.update.mockResolvedValueOnce(mockRequest);
      const result = await service.update('req-1', 'other-user', true, { peopleCount: 5 });
      expect(result).toEqual(mockRequest);
    });

    it('should validate status transition for normal user', async () => {
      mockQueryBuilder.update.mockResolvedValueOnce(mockRequest);
      // PENDING -> ASSIGNED
      await service.update('req-1', 'user-1', false, { status: RescueRequestStatus.ASSIGNED });
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      
      // INVALID PENDING -> RESOLVED
      await expect(service.update('req-1', 'user-1', false, { status: RescueRequestStatus.RESOLVED })).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      mockRescueRequestModel.first.mockResolvedValue(mockRequest);
    });

    it('should delete request if user is owner', async () => {
      mockQueryBuilder.delete.mockResolvedValueOnce({});
      const result = await service.remove('req-1', 'user-1', false);
      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      await expect(service.remove('req-1', 'other-user', false)).rejects.toThrow(ForbiddenException);
    });
  });
});
