import { Test, TestingModule } from '@nestjs/testing';
import { RescueTeamsController } from './rescue-teams.controller';
import { RescueTeamsService } from './rescue-teams.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/enums/user-role.enum';
import { TeamMemberRole } from '../common/enums/team.enum';

describe('RescueTeamsController', () => {
  let controller: RescueTeamsController;
  let service: RescueTeamsService;

  const mockRescueTeamsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addMember: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RescueTeamsController],
      providers: [
        {
          provide: RescueTeamsService,
          useValue: mockRescueTeamsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<RescueTeamsController>(RescueTeamsController);
    service = module.get<RescueTeamsService>(RescueTeamsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addMember', () => {
    it('should throw ForbiddenException if RESCUER is not the leader', async () => {
      const req = { user: { id: 'rescuer-not-leader', role: UserRole.RESCUER } };
      mockRescueTeamsService.findOne.mockResolvedValue({ leaderId: 'other-leader-id' });

      await expect(
        controller.addMember('team1', { userId: 'user2', role: TeamMemberRole.MEMBER }, req)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow if RESCUER is the leader', async () => {
      const req = { user: { id: 'rescuer-leader', role: UserRole.RESCUER } };
      mockRescueTeamsService.findOne.mockResolvedValue({ leaderId: 'rescuer-leader' });
      mockRescueTeamsService.addMember.mockResolvedValue({ id: 'mem1' });

      const result = await controller.addMember('team1', { userId: 'user2', role: TeamMemberRole.MEMBER }, req);
      expect(result).toEqual({ id: 'mem1' });
    });
  });

  describe('removeMember', () => {
    it('should allow USER to remove themselves', async () => {
      const req = { user: { id: 'user-id', role: UserRole.USER } };
      mockRescueTeamsService.removeMember.mockResolvedValue({ message: 'Success' });

      const result = await controller.removeMember('team1', 'user-id', req);
      expect(result).toEqual({ message: 'Success' });
    });

    it('should throw ForbiddenException if USER tries to remove someone else', async () => {
      const req = { user: { id: 'user-id', role: UserRole.USER } };

      await expect(
        controller.removeMember('team1', 'other-id', req)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
