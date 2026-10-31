import { Test, TestingModule } from '@nestjs/testing';
import { WarningsController } from './warnings.controller';
import { WarningsService } from './warnings.service';
import { Severity } from '../common/enums/disaster.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('WarningsController', () => {
  let controller: WarningsController;
  let service: WarningsService;

  const mockWarning = {
    id: '1',
    disasterId: 'd1',
    title: 'Test Warning',
    message: 'Test Message',
    severity: Severity.HIGH,
    issuedAt: new Date(),
    expiresAt: null,
  };

  const mockWarningsService = {
    create: jest.fn().mockResolvedValue(mockWarning),
    findAll: jest.fn().mockResolvedValue([mockWarning]),
    findOne: jest.fn().mockResolvedValue(mockWarning),
    update: jest.fn().mockResolvedValue(mockWarning),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarningsController],
      providers: [
        {
          provide: WarningsService,
          useValue: mockWarningsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WarningsController>(WarningsController);
    service = module.get<WarningsService>(WarningsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a warning', async () => {
    const dto = {
      disasterId: 'd1',
      title: 'Test Warning',
      message: 'Test Message',
      severity: Severity.HIGH,
    };
    const result = await controller.create(dto);
    expect(result).toEqual({ success: true, data: mockWarning });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should find all warnings', async () => {
    const result = await controller.findAll();
    expect(result).toEqual({ success: true, data: [mockWarning], meta: { total: 1 } });
    expect(service.findAll).toHaveBeenCalledWith({ severity: undefined, disasterId: undefined, active: undefined });
  });

  it('should find one warning', async () => {
    const result = await controller.findOne('1');
    expect(result).toEqual({ success: true, data: mockWarning });
    expect(service.findOne).toHaveBeenCalledWith('1');
  });

  it('should update a warning', async () => {
    const dto = { title: 'Updated' };
    const result = await controller.update('1', dto);
    expect(result).toEqual({ success: true, data: mockWarning });
    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('should remove a warning', async () => {
    const result = await controller.remove('1');
    expect(result).toEqual({ success: true });
    expect(service.remove).toHaveBeenCalledWith('1');
  });
});
