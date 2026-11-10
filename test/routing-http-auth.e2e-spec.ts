import { HttpHarness, startHarness } from './fixtures/routing/http-harness';

describe('P5-I01 real HTTP JWT and roles', () => {
  let h: HttpHarness;
  beforeAll(async () => {
    h = await startHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(() => h.storage.reset());

  it.each([
    ['missing JWT', undefined],
    ['malformed JWT', 'not.a.jwt'],
    [
      'unsigned JWT',
      `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"admin"}').toString('base64url')}.`,
    ],
  ])('rejects %s before storage access', async (_name, token) => {
    const response = await h.current(token);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: { statusCode: 401, message: 'Unauthorized' },
    });
    expect(h.storage.reads).toBe(0);
  });

  it.each([
    ['wrong signature', { sub: 'admin' }, true],
    [
      'expired JWT',
      { sub: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
      false,
    ],
    [
      'future nbf',
      { sub: 'admin', nbf: Math.floor(Date.now() / 1000) + 3600 },
      false,
    ],
  ] as const)(
    'rejects %s through Passport verification',
    async (_name, claims, wrongSecret) => {
      const response = await h.current(h.token(claims, wrongSecret));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        error: { statusCode: 401, message: 'Unauthorized' },
      });
      expect(h.storage.reads).toBe(0);
    },
  );

  it.each([
    ['missing sub', {}],
    ['numeric sub', { sub: 123 }],
    ['object sub', { sub: { id: 'admin' } }],
    ['unknown subject', { sub: 'does-not-exist' }],
  ])('rejects %s at isolated user lookup boundary', async (_name, claims) => {
    const response = await h.current(h.token(claims));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: { statusCode: 401, message: 'User not found' },
    });
    expect(h.storage.reads).toBe(0);
  });

  it.each(['banned', 'inactive'])(
    'rejects %s user via real strategy',
    async (sub) => {
      const response = await h.current(h.token({ sub }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        error: { statusCode: 401, message: 'User is not active' },
      });
      expect(h.storage.reads).toBe(0);
    },
  );

  it.each(['user', 'pending-rescuer', 'no-role'])(
    'denies %s via real RolesGuard',
    async (sub) => {
      const response = await h.current(h.token({ sub, role: 'ADMIN' }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        success: false,
        error: { statusCode: 403, message: 'Forbidden resource' },
      });
      expect(h.storage.reads).toBe(0);
    },
  );

  it.each(['rescuer', 'admin', 'moderator'])(
    'allows %s from stored user role without JWT role claim',
    async (sub) => {
      const response = await h.current(h.token({ sub }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        strictRoutingReady: false,
        liveHazardReady: false,
        canAttemptStrictRouting: false,
        overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
        manifest: {
          canAttemptStrictRouting: false,
          isStrictRoutingEligible: false,
          isRestrictionStrictRoutingEligible: false,
          overallStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
          strictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
          restrictionStrictRoutingReadiness: 'NOT_READY_NO_VERIFIED_EDGES',
        },
      });
      expect(h.storage.reads).toBe(1);
    },
  );

  it('does not grant ADMIN from a validly signed role claim to USER', async () => {
    const response = await h.current(h.token({ sub: 'user', role: 'ADMIN' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { statusCode: 403 },
    });
    expect(h.storage.reads).toBe(0);
  });

  it('documents that malformed role claims are ignored; stored role controls access', async () => {
    const response = await h.current(
      h.token({ sub: 'admin', role: { malformed: true } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      strictRoutingReady: false,
      canAttemptStrictRouting: false,
    });
  });
});
