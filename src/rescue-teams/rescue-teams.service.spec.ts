import { Test, TestingModule } from '@nestjs/testing';
import { RescueTeamsService } from './rescue-teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamStatus, TeamMemberRole } from '../common/enums/team.enum';
import { UserRole } from '../users/enums/user-role.enum';

describe('RescueTeamsService', () => {
  let service: RescueTeamsService;

  const createPrisma8Mock = (methods: any) => {
    const chain = { ...methods };
    chain.where = jest.fn().mockReturnValue(chain);
    chain.include = jest.fn().mockReturnValue(chain);
    chain.offset = jest.fn().mockReturnValue(chain);
    chain.limit = jest.fn().mockReturnValue(chain);
    return chain;
  };

  const mockRescueTeamModel = createPrisma8Mock({
    first: jest.fn(),
    all: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  });

  const mockTeamMemberModel = createPrisma8Mock({
    first: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  const mockUserModel = createPrisma8Mock({
    first: jest.fn(),
  });

  const mockPrismaService = {
    db: {
      transaction: jest.fn(async (callback) => {
        const tx = {
          orm: {
            public: {
              RescueTeam: mockRescueTeamModel,
              TeamMember: mockTeamMemberModel,
              User: mockUserModel,
            },
          },
        };
        return callback(tx);
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RescueTeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RescueTeamsService>(RescueTeamsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a team and add leader as member', async () => {
      mockUserModel.first.mockResolvedValue({ id: 'user1', role: UserRole.RESCUER, rescueProfile: { verificationStatus: 'APPROVED' } });
      mockRescueTeamModel.create.mockResolvedValue({ id: 'team1', name: 'Team A', leaderId: 'user1' });
      mockTeamMemberModel.create.mockResolvedValue({ id: 'mem1' });

      const result = await service.create({ name: 'Team A', leaderId: 'user1' });
      expect(result).toEqual({ id: 'team1', name: 'Team A', leaderId: 'user1' });
      expect(mockTeamMemberModel.create).toHaveBeenCalledWith({
        teamId: 'team1',
        userId: 'user1',
        role: TeamMemberRole.LEADER,
      });
    });

    it('should throw BadRequestException if leader is not RESCUER', async () => {
      mockUserModel.first.mockResolvedValue({ id: 'user1', role: UserRole.USER });
      await expect(service.create({ name: 'Team A', leaderId: 'user1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update team and swap leader roles', async () => {
      mockRescueTeamModel.first.mockResolvedValue({ id: 'team1', leaderId: 'user1', status: TeamStatus.ACTIVE });
      mockUserModel.first.mockResolvedValue({ id: 'user2', role: UserRole.RESCUER, rescueProfile: { verificationStatus: 'APPROVED' } });
      
      // old leader member
      mockTeamMemberModel.first.mockResolvedValueOnce({ id: 'mem1', userId: 'user1' });
      // new leader member (not exists yet)
      mockTeamMemberModel.first.mockResolvedValueOnce(null);

      mockRescueTeamModel.update.mockResolvedValue({ id: 'team1', leaderId: 'user2' });

      await service.update('team1', { leaderId: 'user2' });

      // old leader demoted
      expect(mockTeamMemberModel.update).toHaveBeenCalledWith({ role: TeamMemberRole.MEMBER });
      // new leader created
      expect(mockTeamMemberModel.create).toHaveBeenCalledWith({
        teamId: 'team1',
        userId: 'user2',
        role: TeamMemberRole.LEADER,
      });
    });
  });
});
