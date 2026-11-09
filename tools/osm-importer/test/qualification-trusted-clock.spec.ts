import {
  inspectClock,
  isolatedTestClock,
  systemDiagnosticClock,
  unavailableTrustedClock,
  verifyValidity,
} from '../src/qualification-trusted-clock';
import { TEST_NOW } from './qualification-verification-test-fixtures';
const window = {
  validFrom: '2026-01-01T00:00:00Z',
  validUntil: TEST_NOW,
  revocationStatus: 'ACTIVE' as const,
};
describe('5C.2A clock provenance and validity semantics', () => {
  it('system clock is diagnostic and never externally trusted', () => {
    const reading = systemDiagnosticClock.read(),
      r = verifyValidity(
        {
          validFrom: '2000-01-01T00:00:00Z',
          validUntil: '2099-01-01T00:00:00Z',
          revocationStatus: 'ACTIVE',
        },
        reading,
      );
    expect(reading.kind).toBe('SYSTEM_DIAGNOSTIC');
    expect(r.status).toBe('UNVERIFIED');
    expect(r.diagnosticCodes).toContain('SYSTEM_CLOCK_DIAGNOSTIC_ONLY');
  });
  it('isolated test clock can verify a closed interval only in TEST_ONLY scope', () => {
    const r = verifyValidity(window, isolatedTestClock(TEST_NOW).read());
    expect(r).toMatchObject({
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      assurance: 'TEST_VALIDITY',
      qualificationEligible: false,
      productionAuthoritative: false,
    });
  });
  it('expiry is strict after validUntil including millisecond boundary', () => {
    expect(
      verifyValidity(
        window,
        isolatedTestClock('2026-06-01T00:00:00.001Z').read(),
      ).status,
    ).toBe('EXPIRED');
  });
  it('future effective time does not pass', () => {
    expect(
      verifyValidity(
        {
          ...window,
          validFrom: '2026-06-01T00:00:01Z',
          validUntil: '2027-01-01T00:00:00Z',
        },
        isolatedTestClock(TEST_NOW).read(),
      ).status,
    ).toBe('UNVERIFIED');
  });
  it('caller backdating cannot create a valid clock reading', () => {
    const fake = {
      kind: 'TEST_ONLY',
      timestamp: '2025-01-01T00:00:00Z',
      sourceReference: 'EXTERNAL_TRUSTED',
    };
    expect(inspectClock(fake)).toBeUndefined();
    expect(verifyValidity(window, fake).status).toBe('VERIFIER_UNAVAILABLE');
  });
  it.each([
    'garbage',
    '2026',
    '2026-01-01',
    '2026-06-01T00:00:00',
    '2026-06-01T00:00:00+00:00',
    '2026-02-30T00:00:00Z',
  ])(
    'invalid UTC %s cannot be a test time or validity endpoint',
    (timestamp) => {
      expect(() => isolatedTestClock(timestamp)).toThrow(
        'INVALID_TEST_CLOCK_UTC',
      );
      expect(
        verifyValidity(
          { ...window, validUntil: timestamp },
          isolatedTestClock(TEST_NOW).read(),
        ).status,
      ).toBe('INVALID');
    },
  );
  it('reversed intervals with mixed fractional UTC format are INVALID', () => {
    expect(
      verifyValidity(
        { ...window, validFrom: '2026-06-01T00:00:00.001Z' },
        isolatedTestClock(TEST_NOW).read(),
      ).status,
    ).toBe('INVALID');
  });
  it('future collection timestamp is INVALID', () => {
    expect(
      verifyValidity(
        { ...window, collectedAt: '2026-06-01T00:00:01Z' },
        isolatedTestClock(TEST_NOW).read(),
      ).diagnosticCodes,
    ).toContain('FUTURE_COLLECTION_TIMESTAMP');
  });
  it('missing trusted clock is unavailable rather than a default now', () => {
    for (const reading of [undefined, null, {}, unavailableTrustedClock.read()])
      expect(verifyValidity(window, reading).status).toBe(
        'VERIFIER_UNAVAILABLE',
      );
  });
  it('missing revocation service cannot be treated as ACTIVE', () => {
    expect(
      verifyValidity(
        { ...window, revocationStatus: 'UNKNOWN' },
        isolatedTestClock(TEST_NOW).read(),
      ).status,
    ).toBe('VERIFIER_UNAVAILABLE');
  });
  it('revoked subject remains REVOKED inside the validity window', () => {
    expect(
      verifyValidity(
        { ...window, revocationStatus: 'REVOKED' },
        isolatedTestClock(TEST_NOW).read(),
      ).status,
    ).toBe('REVOKED');
  });
  it('clock readings are immutable runtime receipts; spreading them loses provenance', () => {
    const reading = isolatedTestClock(TEST_NOW).read();
    expect(Object.isFrozen(reading)).toBe(true);
    expect(inspectClock({ ...reading })).toBeUndefined();
  });
});
