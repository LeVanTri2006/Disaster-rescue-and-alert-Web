import { Test, TestingModule } from '@nestjs/testing';
import { RescueProfilesController } from './rescue-profiles.controller';
import { RescueProfilesService } from './rescue-profiles.service';
import { ProfileVerificationStatus } from '../../users/enums/profile-verification-status.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('RescueProfilesController', () => {
  let controller: RescueProfilesController;
  let service: RescueProfilesService;

  const mockService = {
    getPendingProfiles: jest.fn(),
    getProfileById: jest.fn(),
    updateVerification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RescueProfilesController],
      providers: [
        { provide: RescueProfilesService, useValue: mockService },
      ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: jest.fn(() => true) })
    .overrideGuard(RolesGuard).useValue({ canActivate: jest.fn(() => true) })
    .compile();

    controller = module.get<RescueProfilesController>(RescueProfilesController);
    service = module.get<RescueProfilesService>(RescueProfilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('getPending should call getPendingProfiles', async () => {
    const mockProfiles = [{ id: '1' }];
    mockService.getPendingProfiles.mockResolvedValueOnce(mockProfiles);

    const result = await controller.getPending();

    expect(service.getPendingProfiles).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: mockProfiles });
  });

  it('getById should call getProfileById', async () => {
    const mockProfile = { id: '1' };
    mockService.getProfileById.mockResolvedValueOnce(mockProfile);

    const result = await controller.getById('1');

    expect(service.getProfileById).toHaveBeenCalledWith('1');
    expect(result).toEqual({ success: true, data: mockProfile });
  });

  it('updateVerification should call updateVerification with adminId', async () => {
    const mockProfile = { id: '1', verificationStatus: 'APPROVED' };
    mockService.updateVerification.mockResolvedValueOnce(mockProfile);

    const req = { user: { id: 'admin1' } };
    const result = await controller.updateVerification('1', { status: ProfileVerificationStatus.APPROVED }, req);

    expect(service.updateVerification).toHaveBeenCalledWith('1', 'APPROVED', 'admin1');
    expect(result).toEqual({ success: true, data: mockProfile });
  });
});
