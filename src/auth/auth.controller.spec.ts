import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      createFirebaseToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    })
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => true,
    })
    .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('register delegates correctly', async () => {
    (authService.register as jest.Mock).mockResolvedValue({ id: '1' });
    const result = await controller.register({ email: 'test@example.com', password: 'pwd', fullName: 'test' });
    expect(authService.register).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: { id: '1' } });
  });

  it('login delegates correctly', async () => {
    (authService.login as jest.Mock).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const result = await controller.login({ email: 'test@example.com', password: 'pwd' });
    expect(authService.login).toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: { accessToken: 'a', refreshToken: 'r' } });
  });

  it('refresh delegates correctly', async () => {
    (authService.refresh as jest.Mock).mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });
    const result = await controller.refresh('old_refresh');
    expect(authService.refresh).toHaveBeenCalledWith('old_refresh');
    expect(result).toEqual({ success: true, data: { accessToken: 'a2', refreshToken: 'r2' } });
  });

  it('me returns authenticated user', async () => {
    const mockRequest = { user: { id: '1', email: 'test@example.com' } };
    const result = await controller.getProfile(mockRequest);
    expect(result).toEqual({ success: true, data: mockRequest.user });
  });
});
