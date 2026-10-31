import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      db: {
        orm: {
          public: {
            User: {
              first: jest.fn(),
              create: jest.fn(),
              where: jest.fn().mockReturnThis(),
              include: jest.fn().mockReturnThis(),
              update: jest.fn(),
            },
            RescueProfile: {
              first: jest.fn(),
              create: jest.fn(),
            },
          },
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('create delegates correctly', async () => {
    const mockUser = { id: '1', email: 'test@example.com', password: 'pwd' };
    prismaService.db.orm.public.User.create.mockResolvedValue(mockUser);
    const result = await service.create({ email: 'test@example.com', password: 'pwd', fullName: 'Test' });
    expect(prismaService.db.orm.public.User.create).toHaveBeenCalled();
    expect(result.password).toBeUndefined();
    expect(result.id).toEqual('1');
  });

  it('findById delegates correctly', async () => {
    const mockUser = { id: '1', email: 'test@example.com', password: 'pwd' };
    prismaService.db.orm.public.User.first.mockResolvedValue(mockUser);
    const result = await service.findById('1');
    expect(prismaService.db.orm.public.User.where).toHaveBeenCalledWith({ id: '1' });
    expect(prismaService.db.orm.public.User.include).toHaveBeenCalledWith('rescueProfile');
    expect(prismaService.db.orm.public.User.first).toHaveBeenCalled();
    expect(result?.password).toBeUndefined();
  });

  it('findByEmail delegates correctly', async () => {
    const mockUser = { id: '1', email: 'test@example.com', password: 'pwd' };
    prismaService.db.orm.public.User.first.mockResolvedValue(mockUser);
    const result = await service.findByEmail('test@example.com');
    expect(prismaService.db.orm.public.User.first).toHaveBeenCalledWith({ email: 'test@example.com' });
    // This one returns the password (needed for auth)
    expect(result?.password).toEqual('pwd');
  });

  it('update delegates correctly', async () => {
    const mockUser = { id: '1', email: 'test@example.com', fullName: 'New Name', password: 'pwd' };
    prismaService.db.orm.public.User.first.mockResolvedValue(mockUser);
    prismaService.db.orm.public.User.update.mockResolvedValue(mockUser);
    const result = await service.update('1', { fullName: 'New Name' });
    
    expect(prismaService.db.orm.public.User.first).toHaveBeenCalledWith({ id: '1' });
    expect(prismaService.db.orm.public.User.where).toHaveBeenCalledWith({ id: '1' });
    expect(prismaService.db.orm.public.User.update).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'New Name'
    }));
    expect(result?.password).toBeUndefined();
    expect(result?.fullName).toEqual('New Name');
  });

  it('updateRole to USER delegates correctly without RescueProfile', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'USER', password: 'pwd' };
    prismaService.db.orm.public.User.first.mockResolvedValue(mockUser);
    prismaService.db.orm.public.User.update.mockResolvedValue({ ...mockUser, role: 'USER' });
    
    const result = await service.updateRole('1', 'USER' as any);
    
    expect(prismaService.db.orm.public.User.update).toHaveBeenCalledWith(expect.objectContaining({
      role: 'USER'
    }));
    expect(prismaService.db.orm.public.RescueProfile.first).not.toHaveBeenCalled();
    expect(result.role).toEqual('USER');
  });

  it('updateRole to RESCUER creates RescueProfile with PENDING status', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'USER', password: 'pwd' };
    prismaService.db.orm.public.User.first.mockResolvedValue(mockUser);
    prismaService.db.orm.public.User.update.mockResolvedValue({ ...mockUser, role: 'RESCUER' });
    
    // Simulate no existing profile
    prismaService.db.orm.public.RescueProfile.first.mockResolvedValue(null);
    prismaService.db.orm.public.RescueProfile.create.mockResolvedValue({ id: 'prof-1' });

    const result = await service.updateRole('1', 'RESCUER' as any);
    
    expect(prismaService.db.orm.public.RescueProfile.first).toHaveBeenCalledWith({ userId: '1' });
    expect(prismaService.db.orm.public.RescueProfile.create).toHaveBeenCalledWith({
      userId: '1',
      verificationStatus: 'PENDING',
      skills: [],
    });
    expect(result.role).toEqual('RESCUER');
  });

  it('updateRole rejects invalid roles like ADMIN', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'USER' };
    prismaService.db.orm.public.User.first.mockResolvedValue(mockUser);
    
    await expect(service.updateRole('1', 'ADMIN' as any)).rejects.toThrow('Invalid role selected');
  });
});
