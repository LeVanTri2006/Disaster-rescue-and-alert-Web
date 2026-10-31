import { Test, TestingModule } from '@nestjs/testing';
import { RescueMissionsController } from './rescue-missions.controller';
import { RescueMissionsService } from './rescue-missions.service';
import { CreateRescueMissionDto } from './dto/create-rescue-mission.dto';
import { UpdateRescueMissionDto } from './dto/update-rescue-mission.dto';
import { QueryRescueMissionDto } from './dto/query-rescue-mission.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { MissionStatus } from '../common/enums/mission-status.enum';
import { ForbiddenException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('RescueMissionsController', () => {
  let controller: RescueMissionsController;
  let service: RescueMissionsService;

  const mockRescueMissionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RescueMissionsController],
      providers: [
        {
          provide: RescueMissionsService,
          useValue: mockRescueMissionsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<RescueMissionsController>(RescueMissionsController);
    service = module.get<RescueMissionsService>(RescueMissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service create method', async () => {
      const dto: CreateRescueMissionDto = { requestId: 'req-1', rescuerId: 'user-1' };
      const expectedResult = { id: 'mission-1', ...dto, status: MissionStatus.ASSIGNED };
      mockRescueMissionsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);
      expect(result).toEqual({ success: true, data: expectedResult });
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findMyMissions', () => {
    it('should inject rescuerId into query and return paginated list', async () => {
      const query: QueryRescueMissionDto = { page: 1, limit: 10 };
      const req = { user: { id: 'rescuer-1' } };
      
      mockRescueMissionsService.findAll.mockResolvedValue({
        data: [{ id: 'mission-1' }],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findMyMissions(req, query);
      
      expect(query.rescuerId).toEqual('rescuer-1');
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should allow ADMIN to view any mission', async () => {
      const req = { user: { id: 'admin-1', role: UserRole.ADMIN } };
      mockRescueMissionsService.findOne.mockResolvedValue({ id: 'mission-1', rescuerId: 'other-user' });

      const result = await controller.findOne(req, 'mission-1');
      expect(result.data.id).toBe('mission-1');
    });

    it('should throw ForbiddenException if RESCUER views mission assigned to another', async () => {
      const req = { user: { id: 'rescuer-1', role: UserRole.RESCUER } };
      mockRescueMissionsService.findOne.mockResolvedValue({ id: 'mission-1', rescuerId: 'other-rescuer' });

      await expect(controller.findOne(req, 'mission-1')).rejects.toThrow(ForbiddenException);
    });

    it('should allow USER to view mission for their own request', async () => {
      const req = { user: { id: 'user-1', role: UserRole.USER } };
      mockRescueMissionsService.findOne.mockResolvedValue({
        id: 'mission-1',
        request: { requesterId: 'user-1' },
      });

      const result = await controller.findOne(req, 'mission-1');
      expect(result.data.id).toBe('mission-1');
    });

    it('should throw ForbiddenException if USER views mission for another request', async () => {
      const req = { user: { id: 'user-1', role: UserRole.USER } };
      mockRescueMissionsService.findOne.mockResolvedValue({
        id: 'mission-1',
        request: { requesterId: 'other-user' },
      });

      await expect(controller.findOne(req, 'mission-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should prevent USER from updating', async () => {
      const req = { user: { id: 'user-1', role: UserRole.USER } };
      const dto: UpdateRescueMissionDto = { status: MissionStatus.IN_ROUTE };

      await expect(controller.update(req, 'mission-1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('should pass correct user role and id to service for authorization', async () => {
      const req = { user: { id: 'rescuer-1', role: UserRole.RESCUER } };
      const dto: UpdateRescueMissionDto = { status: MissionStatus.IN_ROUTE };
      
      mockRescueMissionsService.update.mockResolvedValue({ id: 'mission-1' });

      await controller.update(req, 'mission-1', dto);
      expect(service.update).toHaveBeenCalledWith('mission-1', dto, UserRole.RESCUER, 'rescuer-1');
    });
  });
});
