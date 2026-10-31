import { buildSosRealtimeUpdates, SosRealtimeProjection } from './firebase-sos.publisher';

describe('Firebase SOS realtime projection keys', () => {
  const projection: SosRealtimeProjection = {
    eventId: 'sos-1',
    status: 'ACTIVE',
    latitude: 10,
    longitude: 20,
    accuracyMeters: 5,
    adults: 1,
    children: 0,
    elderly: 0,
    neededItems: ['Nước uống'],
    condition: 'Bị thương',
    urgency: 'HIGH',
    createdAt: '2026-09-16T10:00:00.000Z',
    batteryPercent: 80,
    updatedAt: '2026-09-16T10:00:01.000Z',
  };

  it('writes the same minimal projection to operational and owner-scoped paths', () => {
    expect(buildSosRealtimeUpdates('user-1', projection)).toEqual({
      'sos-events/sos-1': projection,
      'sos-owner-events/user-1/sos-1': projection,
    });
  });

  it('is idempotent for a retry and preserves terminal status updates', () => {
    const resolved = { ...projection, status: 'RESOLVED', updatedAt: '2026-09-16T10:01:00.000Z' };
    expect(buildSosRealtimeUpdates('user-1', resolved)).toEqual(
      buildSosRealtimeUpdates('user-1', resolved),
    );
    expect(buildSosRealtimeUpdates('user-1', resolved)['sos-events/sos-1'].status).toBe('RESOLVED');
  });
});
