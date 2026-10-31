import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { FirebaseSosPublisher } from '../firebase/firebase-sos.publisher';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../users/enums/user-status.enum';
import { UserRole } from '../users/enums/user-role.enum';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let mailService: jest.Mocked<Partial<MailService>>;
  let firebasePublisher: jest.Mocked<Partial<FirebaseSosPublisher>>;

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    mailService = {
      sendOtp: jest.fn(),
    };

    firebasePublisher = {
      createCustomToken: jest.fn().mockResolvedValue('firebase_custom_token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        { provide: FirebaseSosPublisher, useValue: firebasePublisher },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    process.env.JWT_ACCESS_SECRET = 'access_secret';
    process.env.JWT_REFRESH_SECRET = 'refresh_secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register successfully', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.findByPhone as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (usersService.create as jest.Mock).mockResolvedValue({ id: '1', email: 'test@example.com' });

      const result = await service.register({ email: 'test@example.com', password: 'password123', fullName: 'Test' });
      expect(result).toEqual({
        user: { id: '1', email: 'test@example.com' },
        accessToken: undefined,
        refreshToken: undefined,
        isNewUser: true,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersService.create).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed_password' }));
    });

    it('should reject duplicate email', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue({ id: '1' });
      await expect(service.register({ email: 'test@example.com', password: 'pwd', fullName: 'Test' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate phone', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersService.findByPhone as jest.Mock).mockResolvedValue({ id: '1' });
      await expect(service.register({ phone: '123456789', password: 'pwd', fullName: 'Test' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should reject missing email and phone', async () => {
      await expect(service.register({ password: 'pwd', fullName: 'Test' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should login by email and generate accessToken/refreshToken', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.ACTIVE, password: 'hashed_password' };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('access_token')
        .mockReturnValueOnce('refresh_token');

      const result = await service.login({ email: 'test@example.com', password: 'password123' });
      expect(result).toEqual({ accessToken: 'access_token', refreshToken: 'refresh_token' });
    });

    it('should login by phone', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.ACTIVE, password: 'hashed_password' };
      (usersService.findByPhone as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.sign as jest.Mock).mockReturnValue('token');

      await service.login({ phone: '123456789', password: 'password123' });
      expect(usersService.findByPhone).toHaveBeenCalledWith('123456789');
    });

    it('should reject invalid password', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.ACTIVE, password: 'hashed_password' };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@example.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('should reject BANNED users', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.BANNED, password: 'hashed_password' };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.login({ email: 'test@example.com', password: 'pwd' })).rejects.toThrow(ForbiddenException);
    });

    it('should reject INACTIVE users', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.INACTIVE, password: 'hashed_password' };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.login({ email: 'test@example.com', password: 'pwd' })).rejects.toThrow(ForbiddenException);
    });

    it('should reject PENDING users', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.PENDING, password: 'hashed_password' };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      await expect(service.login({ email: 'test@example.com', password: 'pwd' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully', async () => {
      const mockUser = { id: '1', role: UserRole.USER, status: UserStatus.ACTIVE };
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: '1' });
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce('new_access_token')
        .mockReturnValueOnce('new_refresh_token');

      const result = await service.refresh('valid_token');
      expect(result).toEqual({ accessToken: 'new_access_token', refreshToken: 'new_refresh_token' });
    });

    it('should reject invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => { throw new Error('invalid') });
      await expect(service.refresh('invalid_token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
