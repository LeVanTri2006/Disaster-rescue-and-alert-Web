import { Test, TestingModule } from '@nestjs/testing';
import { RescueRequestsController } from './rescue-requests.controller';
import { RescueRequestsService } from './rescue-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('RescueRequestsController', () => {
  let controller: RescueRequestsController;
  let service: RescueRequestsService;

  const mockRequest = {
    id: 'req-1',
    requesterId: 'user-1',
    peopleCount: 2,
    urgency: 'HIGH',
    description: 'Test Request',
    status: 'PENDING',
    location: 'geometry-placeholder',
  };

  const mockRescueRequestsService = {
    create: jest.fn().mockResolvedValue(mockRequest),
    findAll: jest.fn().mockResolvedValue({ data: [mockRequest], total: 1, page: 1, limit: 10 }),
    findNearby: jest.fn().mockResolvedValue([mockRequest]),
    findOne: jest.fn().mockResolvedValue(mockRequest),
    update: jest.fn().mockResolvedValue({ ...mockRequest, peopleCount: 5 }),
    remove: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RescueRequestsController],
      providers: [
        {
          provide: RescueRequestsService,
          useValue: mockRescueRequestsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RescueRequestsController>(RescueRequestsController);
    service = module.get<RescueRequestsService>(RescueRequestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a request', async () => {
    const dto: any = { latitude: 10, longitude: 20 };
    const req = { user: { id: 'user-1' } };
    
    const result = await controller.create(req, dto);
    
    expect(result).toEqual({ success: true, data: mockRequest });
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('should find nearby requests', async () => {
    const result = await controller.findNearby(10.0, 20.0, 5000);
    
    expect(result).toEqual({ success: true, data: [mockRequest] });
    expect(service.findNearby).toHaveBeenCalledWith(10.0, 20.0, 5000);
  });

  it('should find my requests', async () => {
    const req = { user: { id: 'user-1' } };
    const result = await controller.findMyRequests(req, {});
    
    expect(result.data).toEqual([mockRequest]);
    expect(service.findAll).toHaveBeenCalledWith({}, 'user-1');
  });

  it('should find all requests (admin)', async () => {
    const result = await controller.findAll({});
    
    expect(result.data).toEqual([mockRequest]);
    expect(service.findAll).toHaveBeenCalledWith({});
  });

  it('should find one request', async () => {
    const req = { user: { id: 'user-1', role: 'USER' } };
    const result = await controller.findOne('req-1', req);
    
    expect(result.data).toEqual(mockRequest);
    expect(service.findOne).toHaveBeenCalledWith('req-1');
  });

  it('should update a request', async () => {
    const req = { user: { id: 'user-1', role: 'USER' } };
    const dto: any = { peopleCount: 5 };
    const result = await controller.update('req-1', req, dto);
    
    expect(result.data.peopleCount).toBe(5);
    expect(service.update).toHaveBeenCalledWith('req-1', 'user-1', false, dto);
  });

  it('should remove a request', async () => {
    const req = { user: { id: 'user-1', role: 'USER' } };
    const result = await controller.remove('req-1', req);
    
    expect(result.success).toBe(true);
    expect(service.remove).toHaveBeenCalledWith('req-1', 'user-1', false);
  });
});
