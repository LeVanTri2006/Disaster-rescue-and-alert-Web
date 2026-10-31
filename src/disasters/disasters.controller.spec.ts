import { Test, TestingModule } from '@nestjs/testing';
import { DisastersController } from './disasters.controller';
import { DisastersService } from './disasters.service';
import { DisasterType, Severity, DisasterStatus } from '../common/enums/disaster.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('DisastersController', () => {
  let controller: DisastersController;
  let service: DisastersService;

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

  const mockDisastersService = {
    create: jest.fn().mockResolvedValue(mockDisaster),
    findAll: jest.fn().mockResolvedValue([mockDisaster]),
    findOne: jest.fn().mockResolvedValue(mockDisaster),
    update: jest.fn().mockResolvedValue(mockDisaster),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisastersController],
      providers: [
        {
          provide: DisastersService,
          useValue: mockDisastersService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DisastersController>(DisastersController);
    service = module.get<DisastersService>(DisastersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a disaster', async () => {
    const dto = {
      type: DisasterType.STORM,
      title: 'Test Storm',
      severity: Severity.HIGH,
    };
    const result = await controller.create(dto);
    expect(result).toEqual({ success: true, data: mockDisaster });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should find all disasters', async () => {
    const result = await controller.findAll();
    expect(result).toEqual({ success: true, data: [mockDisaster], meta: { total: 1 } });
    expect(service.findAll).toHaveBeenCalledWith({ type: undefined, severity: undefined, status: undefined });
  });

  it('should find one disaster', async () => {
    const result = await controller.findOne('1');
    expect(result).toEqual({ success: true, data: mockDisaster });
    expect(service.findOne).toHaveBeenCalledWith('1');
  });

  it('should update a disaster', async () => {
    const dto = { title: 'Updated' };
    const result = await controller.update('1', dto);
    expect(result).toEqual({ success: true, data: mockDisaster });
    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('should remove a disaster', async () => {
    const result = await controller.remove('1');
    expect(result).toEqual({ success: true });
    expect(service.remove).toHaveBeenCalledWith('1');
  });
});
