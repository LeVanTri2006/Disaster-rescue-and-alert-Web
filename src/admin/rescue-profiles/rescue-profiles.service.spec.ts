import { Test, TestingModule } from '@nestjs/testing';
import { RescueProfilesService } from './rescue-profiles.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileVerificationStatus } from '../../users/enums/profile-verification-status.enum';

describe('RescueProfilesService', () => {
  let service: RescueProfilesService;

  const createPrisma8Mock = (methods: any) => {
    const chain = { ...methods };
    chain.where = jest.fn().mockReturnValue(chain);
    chain.include = jest.fn().mockReturnValue(chain);
    return chain;
  };

  const mockRescueProfileModel = createPrisma8Mock({
    all: jest.fn(),
    first: jest.fn(),
    update: jest.fn(),
  });

  const mockPrismaService = {
    db: {
      orm: {
        public: {
          RescueProfile: mockRescueProfileModel,
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RescueProfilesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RescueProfilesService>(RescueProfilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingProfiles', () => {
    it('should return pending profiles and exclude user password', async () => {
      const mockProfiles = [
        { id: '1', verificationStatus: 'PENDING', user: { id: 'u1', password: 'pwd', email: 'test@test.com' } }
      ];
      mockRescueProfileModel.all.mockResolvedValueOnce(mockProfiles);

      const result = await service.getPendingProfiles();

      expect(mockRescueProfileModel.where).toHaveBeenCalledWith({ verificationStatus: 'PENDING' });
      expect(result).toHaveLength(1);
      expect(result[0].user.password).toBeUndefined();
      expect(result[0].user.email).toBe('test@test.com');
    });
  });

  describe('getProfileById', () => {
    it('should return a profile and exclude password', async () => {
      const mockProfile = { id: '1', user: { id: 'u1', password: 'pwd' } };
      mockRescueProfileModel.first.mockResolvedValueOnce(mockProfile);

      const result = await service.getProfileById('1');

      expect(mockRescueProfileModel.where).toHaveBeenCalledWith({ id: '1' });
      expect(result.user.password).toBeUndefined();
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      mockRescueProfileModel.first.mockResolvedValueOnce(null);

      await expect(service.getProfileById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateVerification', () => {
    it('should update verification status to APPROVED', async () => {
      const mockProfile = { id: '1', verificationStatus: 'PENDING' };
      mockRescueProfileModel.first.mockResolvedValueOnce(mockProfile);
      mockRescueProfileModel.update.mockResolvedValueOnce({ ...mockProfile, verificationStatus: 'APPROVED' });

      const result = await service.updateVerification('1', ProfileVerificationStatus.APPROVED, 'admin1');

      expect(mockRescueProfileModel.where).toHaveBeenCalledWith({ id: '1' });
      expect(mockRescueProfileModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ verificationStatus: 'APPROVED' })
      );
      expect(result.verificationStatus).toBe('APPROVED');
    });

    it('should throw BadRequestException if status is invalid', async () => {
      await expect(service.updateVerification('1', 'PENDING' as any, 'admin1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if profile does not exist during update', async () => {
      mockRescueProfileModel.first.mockResolvedValueOnce(null);

      await expect(service.updateVerification('1', ProfileVerificationStatus.APPROVED, 'admin1')).rejects.toThrow(NotFoundException);
    });
  });
});
