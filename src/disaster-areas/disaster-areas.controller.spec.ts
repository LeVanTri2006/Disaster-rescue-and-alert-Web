import { Test, TestingModule } from '@nestjs/testing';
import { DisasterAreasController } from './disaster-areas.controller';
import { DisasterAreasService } from './disaster-areas.service';
import { Severity } from '../common/enums/disaster.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('DisasterAreasController', () => {
  let controller: DisasterAreasController;
  let service: DisasterAreasService;

  const mockDisasterArea = {
    id: '1',
    disasterId: 'd1',
    severity: Severity.HIGH,
    population: 1000,
    area: 'SRID=4326;POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))',
  };

  const mockDisasterAreasService = {
    create: jest.fn().mockResolvedValue(mockDisasterArea),
    findAll: jest.fn().mockResolvedValue([mockDisasterArea]),
    findOne: jest.fn().mockResolvedValue(mockDisasterArea),
    update: jest.fn().mockResolvedValue(mockDisasterArea),
    remove: jest.fn().mockResolvedValue({ success: true }),
    searchNearby: jest.fn().mockResolvedValue([mockDisasterArea]),
    checkIntersects: jest.fn().mockResolvedValue([mockDisasterArea]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisasterAreasController],
      providers: [
        {
          provide: DisasterAreasService,
          useValue: mockDisasterAreasService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DisasterAreasController>(DisasterAreasController);
    service = module.get<DisasterAreasService>(DisasterAreasService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a disaster area', async () => {
    const dto = {
      disasterId: 'd1',
      severity: Severity.HIGH,
      area: {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
      },
    };
    const result = await controller.create(dto);
    expect(result).toEqual({ success: true, data: mockDisasterArea });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should find all disaster areas', async () => {
    const result = await controller.findAll();
    expect(result).toEqual({ success: true, data: [mockDisasterArea], meta: { total: 1 } });
    expect(service.findAll).toHaveBeenCalledWith({ disasterId: undefined });
  });

  it('should search nearby', async () => {
    const result = await controller.searchNearby('10', '20', '1000');
    expect(result).toEqual({ success: true, data: [mockDisasterArea], meta: { total: 1 } });
    expect(service.searchNearby).toHaveBeenCalledWith(10, 20, 1000);
  });

  it('should check intersects', async () => {
    const result = await controller.checkIntersects('10', '20');
    expect(result).toEqual({ success: true, data: [mockDisasterArea], meta: { total: 1 } });
    expect(service.checkIntersects).toHaveBeenCalledWith(10, 20);
  });

  it('should find one disaster area', async () => {
    const result = await controller.findOne('1');
    expect(result).toEqual({ success: true, data: mockDisasterArea });
    expect(service.findOne).toHaveBeenCalledWith('1');
  });

  it('should update a disaster area', async () => {
    const dto = { population: 2000 };
    const result = await controller.update('1', dto);
    expect(result).toEqual({ success: true, data: mockDisasterArea });
    expect(service.update).toHaveBeenCalledWith('1', dto);
  });

  it('should remove a disaster area', async () => {
    const result = await controller.remove('1');
    expect(result).toEqual({ success: true });
    expect(service.remove).toHaveBeenCalledWith('1');
  });
});
