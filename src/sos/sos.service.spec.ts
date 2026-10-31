import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { SosService } from './sos.service';
import { Severity } from '../common/enums/disaster.enum';
import { UserRole } from '../users/enums/user-role.enum';

describe('SosService', () => {
  let service: SosService;
  let rawRows: any[];
  const sosModel = {
    where: jest.fn(),
    create: jest.fn(),
  };
  const sosPhotoModel = {
    where: jest.fn(),
    create: jest.fn(),
  };
  const rescueRequestModel = {
    where: jest.fn(),
    create: jest.fn(),
  };
  const rawSql = jest.fn(() => ({
    returnsRow: jest.fn(() => ({ build: jest.fn(() => 'plan') })),
  }));
  const rawQuery = jest.fn();
  const prisma: any = {
    db: {
      transaction: jest.fn(async (cb) => cb({ orm: prisma.db.orm })), 
      orm: { public: { SOSEvent: sosModel, SOSPhoto: sosPhotoModel, RescueRequest: rescueRequestModel } },
      raw: { sql: rawSql },
      runtime: () => ({ query: rawQuery }),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    rawRows = [];
    rawQuery.mockImplementation(async () => rawRows);
    sosModel.where.mockReturnValue({
      first: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'sos-1' }),
      delete: jest.fn().mockResolvedValue(true),
    });
    sosModel.create.mockResolvedValue({ id: 'sos-1' });
    sosPhotoModel.create.mockResolvedValue({ id: 'photo-1' });
    rescueRequestModel.create.mockResolvedValue({ id: 'req-1' });
    service = new SosService(prisma);
  });

  const event = (overrides: Record<string, unknown> = {}) => ({
    eventId: 'sos-1',
    userId: 'user-1',
    adults: 1,
    children: 0,
    elderly: 0,
    totalPeople: 1,
    neededItems: [],
    condition: 'Bị thương',
    description: null,
    latitude: 10,
    longitude: 20,
    accuracyMeters: 5,
    batteryPercent: 80,
    createdAt: '2026-09-16T10:00:00.000Z',
    status: 'ACTIVE',
    urgency: Severity.HIGH,
    transportMode: 'ONLINE',
    photoUrl: null,
    photos: [],
    ...overrides,
  });

  it('creates an SOS owned by the authenticated user', async () => {
    rawRows = [event()];
    const result = await service.create('user-1', {
      adults: 1,
      children: 0,
      elderly: 0,
      neededItems: ['Nước uống'],
      condition: 'Bị thương',
      latitude: 10,
      longitude: 20,
      accuracyMeters: 5,
      batteryPercent: 80,
      urgency: Severity.HIGH,
    });

    expect(sosModel.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      location: { type: 'Point', coordinates: [20, 10] },
      transportMode: 'ONLINE',
    }));
    expect(result).toEqual(event());
  });

  it('publishes a minimal projection after the database commit', async () => {
    rawRows = [event()];
    const publisher = {
      enabled: true,
      publish: jest.fn().mockResolvedValue(undefined),
      createCustomToken: jest.fn(),
    };
    const publishingService = new SosService(prisma, publisher as any);

    await publishingService.create('user-1', {
      adults: 1,
      children: 0,
      elderly: 0,
      neededItems: ['Nước uống'],
      condition: 'Bị thương',
      latitude: 10,
      longitude: 20,
      accuracyMeters: 5,
      batteryPercent: 80,
      urgency: Severity.HIGH,
    });

    expect(publisher.publish).toHaveBeenCalledWith('user-1', expect.objectContaining({
      eventId: 'sos-1',
      status: 'ACTIVE',
      neededItems: [],
      latitude: 10,
      longitude: 20,
    }));
  });

  it('does not fail the SOS request when realtime publication fails', async () => {
    rawRows = [event()];
    const publisher = {
      enabled: true,
      publish: jest.fn().mockRejectedValue(new Error('firebase unavailable')),
      createCustomToken: jest.fn(),
    };
    const publishingService = new SosService(prisma, publisher as any);

    await expect(publishingService.create('user-1', {
      adults: 1,
      children: 0,
      elderly: 0,
      condition: 'Bị thương',
      latitude: 10,
      longitude: 20,
    })).resolves.toEqual(event());
  });

  it('publishes the terminal status after resolving an SOS', async () => {
    const publisher = {
      enabled: true,
      publish: jest.fn().mockResolvedValue(undefined),
      createCustomToken: jest.fn(),
    };
    const publishingService = new SosService(prisma, publisher as any);
    rawQuery.mockResolvedValueOnce([event()]).mockResolvedValueOnce([event({ status: 'RESOLVED' })]);

    await publishingService.resolve('sos-1', 'user-1', UserRole.USER);

    expect(publisher.publish).toHaveBeenCalledWith('user-1', expect.objectContaining({
      eventId: 'sos-1',
      status: 'RESOLVED',
    }));
  });

  it('rejects an invalid people total', async () => {
    await expect(service.create('user-1', {
      adults: 0,
      children: 0,
      elderly: 0,
      condition: 'Bị thương',
      latitude: 10,
      longitude: 20,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an active duplicate for the same user', async () => {
    sosModel.where.mockReturnValue({
      first: jest.fn().mockResolvedValue({ id: 'existing' }),
    });

    await expect(service.create('user-1', {
      adults: 1,
      children: 0,
      elderly: 0,
      condition: 'Bị thương',
      latitude: 10,
      longitude: 20,
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid coordinates and radius', async () => {
    await expect(service.findNearby(91, 20, 100)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.findNearby(10, 20, 100001)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents IDOR when reading another user SOS', async () => {
    rawRows = [event()];
    await expect(service.findOne('sos-1', 'other-user', UserRole.USER))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows rescuers to inspect active SOS and returns nearby distance query results', async () => {
    rawRows = [event()];
    await expect(service.findOne('sos-1', 'rescuer-1', UserRole.RESCUER)).resolves.toEqual(event());
    await expect(service.findNearby(10, 20, 1000)).resolves.toEqual([event()]);
    expect(rawSql).toHaveBeenCalled();
  });

  it('allows only ACTIVE to RESOLVED or FALSE_ALARM transitions', async () => {
    rawQuery.mockResolvedValueOnce([event()]).mockResolvedValueOnce([event({ status: 'RESOLVED' })]);
    await expect(service.resolve('sos-1', 'user-1', UserRole.USER)).resolves.toEqual(event({ status: 'RESOLVED' }));

    rawRows = [event({ status: 'RESOLVED' })];
    await expect(service.falseAlarm('sos-1', 'user-1', UserRole.USER))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
