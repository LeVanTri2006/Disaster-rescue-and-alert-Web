import { Test, TestingModule } from '@nestjs/testing';
import { RescueMissionsService } from './rescue-missions.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { MissionStatus } from '../common/enums/mission-status.enum';
import { RescueRequestStatus } from '../common/enums/rescue-request.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';

describe('RescueMissionsService', () => {
  let service: RescueMissionsService;

  const createPrisma8Mock = (methods: any) => {
    const chain = { ...methods };
    chain.where = jest.fn().mockReturnValue(chain);
    chain.include = jest.fn().mockReturnValue(chain);
    return chain;
  };

  const mockRescueMissionModel = createPrisma8Mock({
    first: jest.fn(),
    all: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  const mockRescueRequestModel = createPrisma8Mock({
    first: jest.fn(),
    all: jest.fn(),
    update: jest.fn(),
  });

  const mockUserModel = createPrisma8Mock({
    first: jest.fn(),
  });

  const mockRescueTeamModel = createPrisma8Mock({
    first: jest.fn(),
  });

  const mockTx = {
    orm: {
      public: {
        RescueMission: mockRescueMissionModel,
        RescueRequest: mockRescueRequestModel,
        User: mockUserModel,
        RescueTeam: mockRescueTeamModel,
      },
    },
  };

  const mockPrismaService = {
    db: {
      transaction: jest.fn(async (callback) => {
        return callback(mockTx);
      }),
      orm: {
        public: {
          RescueMission: mockRescueMissionModel,
          RescueRequest: mockRescueRequestModel,
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RescueMissionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RescueMissionsService>(RescueMissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw BadRequestException if neither rescuer nor team is provided', async () => {
      await expect(service.create({ requestId: 'req-1' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if both rescuer and team are provided', async () => {
      await expect(service.create({ requestId: 'req-1', rescuerId: 'rescuer-1', teamId: 'team-1' })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if request not found', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce(null);
      await expect(service.create({ requestId: 'req-1', rescuerId: 'rescuer-1' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if request is already RESOLVED', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1', status: RescueRequestStatus.RESOLVED });
      await expect(service.create({ requestId: 'req-1', rescuerId: 'rescuer-1' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if request already has active mission', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1', status: RescueRequestStatus.PENDING });
      mockRescueMissionModel.all.mockResolvedValueOnce([{ status: MissionStatus.IN_PROGRESS }]);
      
      await expect(service.create({ requestId: 'req-1', rescuerId: 'rescuer-1' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rescuer is invalid or inactive', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1', status: RescueRequestStatus.PENDING });
      mockRescueMissionModel.all.mockResolvedValueOnce([]);
      mockUserModel.first.mockResolvedValueOnce({ id: 'rescuer-1', role: UserRole.USER, status: UserStatus.ACTIVE });
      
      await expect(service.create({ requestId: 'req-1', rescuerId: 'rescuer-1' })).rejects.toThrow(BadRequestException);
    });

    it('should create mission and update request status to ASSIGNED', async () => {
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1', status: RescueRequestStatus.PENDING });
      mockRescueMissionModel.all.mockResolvedValueOnce([]);
      mockUserModel.first.mockResolvedValueOnce({ id: 'rescuer-1', role: UserRole.RESCUER, status: UserStatus.ACTIVE, rescueProfile: { verificationStatus: 'APPROVED' } });
      mockRescueMissionModel.create.mockResolvedValueOnce({ id: 'mission-1' });

      const result = await service.create({ requestId: 'req-1', rescuerId: 'rescuer-1' });
      
      expect(result).toEqual({ id: 'mission-1' });
      expect(mockRescueRequestModel.where).toHaveBeenCalledWith({ id: 'req-1' });
      expect(mockRescueRequestModel.update).toHaveBeenCalledWith({ status: RescueRequestStatus.ASSIGNED });
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if mission not found', async () => {
      mockRescueMissionModel.first.mockResolvedValueOnce(null);
      await expect(service.update('mission-1', {}, UserRole.ADMIN, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if rescuer tries to update unassigned mission', async () => {
      mockRescueMissionModel.first.mockResolvedValueOnce({ id: 'mission-1', rescuerId: 'other-rescuer', requestId: 'req-1' });
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1' });
      
      await expect(service.update('mission-1', {}, UserRole.RESCUER, 'rescuer-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException on invalid status transition', async () => {
      mockRescueMissionModel.first.mockResolvedValueOnce({ id: 'mission-1', status: MissionStatus.COMPLETED, requestId: 'req-1' });
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1' });

      await expect(service.update('mission-1', { status: MissionStatus.IN_PROGRESS }, UserRole.ADMIN, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should update mission and sync request status to RESOLVED when COMPLETED', async () => {
      mockRescueMissionModel.first.mockResolvedValueOnce({ id: 'mission-1', status: MissionStatus.IN_PROGRESS, requestId: 'req-1' });
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1', status: RescueRequestStatus.IN_PROGRESS });
      mockRescueMissionModel.update.mockResolvedValueOnce({ id: 'mission-1', status: MissionStatus.COMPLETED });

      await service.update('mission-1', { status: MissionStatus.COMPLETED }, UserRole.ADMIN, 'admin-1');

      expect(mockRescueMissionModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: MissionStatus.COMPLETED, completedAt: expect.anything() })
      );
      expect(mockRescueRequestModel.update).toHaveBeenCalledWith({ status: RescueRequestStatus.RESOLVED });
    });

    it('should sync request status to PENDING when CANCELLED and no other active missions', async () => {
      mockRescueMissionModel.first.mockResolvedValueOnce({ id: 'mission-1', status: MissionStatus.ASSIGNED, requestId: 'req-1', rescuerId: 'rescuer-1' });
      mockRescueRequestModel.first.mockResolvedValueOnce({ id: 'req-1', status: RescueRequestStatus.ASSIGNED });
      mockRescueMissionModel.all.mockResolvedValueOnce([{ id: 'mission-1', status: MissionStatus.ASSIGNED }]); // No other missions
      mockRescueMissionModel.update.mockResolvedValueOnce({ id: 'mission-1', status: MissionStatus.CANCELLED });

      await service.update('mission-1', { status: MissionStatus.CANCELLED }, UserRole.RESCUER, 'rescuer-1');

      expect(mockRescueRequestModel.update).toHaveBeenCalledWith({ status: RescueRequestStatus.PENDING });
    });
  });
});
