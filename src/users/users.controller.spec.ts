import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Partial<UsersService>>;

  beforeEach(async () => {
    usersService = {
      update: jest.fn(),
      updateRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => true,
    })
    .compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('update delegates correctly for self', async () => {
    const mockRequest = { user: { id: '1' } };
    (usersService.update as jest.Mock).mockResolvedValue({ id: '1', fullName: 'New Name' });
    
    const result = await controller.update(mockRequest, '1', { fullName: 'New Name' });
    
    expect(usersService.update).toHaveBeenCalledWith('1', { fullName: 'New Name' });
    expect(result).toEqual({ success: true, data: { id: '1', fullName: 'New Name' } });
  });

  it('update throws ForbiddenException for IDOR', async () => {
    const mockRequest = { user: { id: '1' } }; // Token says user 1
    
    await expect(controller.update(mockRequest, '2', { fullName: 'New Name' }))
      .rejects.toThrow('You can only update your own profile');
    
    expect(usersService.update).not.toHaveBeenCalled();
  });

  it('updateRole delegates correctly using req.user.id', async () => {
    const mockRequest = { user: { id: '1' } };
    (usersService.updateRole as jest.Mock).mockResolvedValue({ id: '1', role: 'RESCUER' });
    
    const result = await controller.updateRole(mockRequest, { role: 'RESCUER' as any });
    
    expect(usersService.updateRole).toHaveBeenCalledWith('1', 'RESCUER');
    expect(result).toEqual({ success: true, data: { id: '1', role: 'RESCUER' } });
  });
});
