import { isObject, isValidIsoTimestamp } from './qualification-validation';
import {
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';

export interface ClockReading {
  readonly kind: 'SYSTEM_DIAGNOSTIC' | 'TEST_ONLY' | 'UNAVAILABLE';
  readonly timestamp: string | null;
  readonly sourceReference: string;
}
export interface ClockProvider {
  read(): ClockReading;
}
const readings = new WeakMap<object, ClockReading>();
function issue(
  kind: ClockReading['kind'],
  timestamp: string | null,
  sourceReference: string,
): ClockReading {
  const reading = Object.freeze({ kind, timestamp, sourceReference });
  readings.set(reading, reading);
  return reading;
}
export const systemDiagnosticClock: ClockProvider = Object.freeze({
  read: () =>
    issue(
      'SYSTEM_DIAGNOSTIC',
      new Date().toISOString(),
      'LOCAL_SYSTEM_CLOCK_NOT_EXTERNALLY_VERIFIED',
    ),
});
export const unavailableTrustedClock: ClockProvider = Object.freeze({
  read: () => issue('UNAVAILABLE', null, 'EXTERNAL_TIME_NOT_CONFIGURED'),
});
/** Arbitrary test dates cannot masquerade as externally verified time. */
export function isolatedTestClock(timestamp: string): ClockProvider {
  if (!isValidIsoTimestamp(timestamp))
    throw new Error('INVALID_TEST_CLOCK_UTC');
  return Object.freeze({
    read: () => issue('TEST_ONLY', timestamp, 'ISOLATED_TEST_CLOCK'),
  });
}
export function inspectClock(reading: unknown): ClockReading | undefined {
  return reading !== null && typeof reading === 'object'
    ? readings.get(reading)
    : undefined;
}
export interface ValidityInput {
  readonly validFrom: unknown;
  readonly validUntil: unknown;
  readonly collectedAt?: unknown;
  readonly revocationStatus: 'ACTIVE' | 'REVOKED' | 'UNKNOWN';
}
export function verifyValidity(
  input: ValidityInput,
  reading: unknown,
): VerificationResult<{
  readonly interval: 'CLOSED';
  readonly diagnosticTimeSource: string;
}> {
  const clock = inspectClock(reading),
    meta = metadata(
      'VALIDITY',
      'validity-window',
      clock?.timestamp ?? null,
      clock?.sourceReference ?? null,
      clock?.kind === 'TEST_ONLY' ? 'TEST_ONLY' : 'TECHNICAL_ONLY',
    );
  const method = { ...meta, method: 'STRICT_UTC_CLOSED_INTERVAL' };
  if (!isObject(input))
    return failure(method, 'INVALID', ['VALIDITY_REQUEST_INVALID']);
  if (!clock || clock.kind === 'UNAVAILABLE' || !clock.timestamp)
    return failure(method, 'VERIFIER_UNAVAILABLE', [
      'CLOCK_UNAVAILABLE_OR_FORGED',
    ]);
  if (
    !isValidIsoTimestamp(input.validFrom) ||
    !isValidIsoTimestamp(input.validUntil) ||
    (input.collectedAt !== undefined && !isValidIsoTimestamp(input.collectedAt))
  )
    return failure(method, 'INVALID', ['INVALID_UTC_TIMESTAMP']);
  if (Date.parse(input.validFrom) > Date.parse(input.validUntil))
    return failure(method, 'INVALID', ['REVERSED_VALIDITY_INTERVAL']);
  if (input.revocationStatus === 'REVOKED')
    return failure(method, 'REVOKED', ['SUBJECT_REVOKED']);
  if (input.revocationStatus !== 'ACTIVE')
    return failure(method, 'VERIFIER_UNAVAILABLE', [
      'REVOCATION_CHECK_UNAVAILABLE',
    ]);
  const at = Date.parse(clock.timestamp);
  if (at > Date.parse(input.validUntil))
    return failure(method, 'EXPIRED', ['VALIDITY_EXPIRED']);
  if (at < Date.parse(input.validFrom))
    return failure(method, 'UNVERIFIED', ['NOT_YET_EFFECTIVE']);
  if (input.collectedAt !== undefined && Date.parse(input.collectedAt) > at)
    return failure(method, 'INVALID', ['FUTURE_COLLECTION_TIMESTAMP']);
  const details = Object.freeze({
    interval: 'CLOSED' as const,
    diagnosticTimeSource: clock.sourceReference,
  });
  if (clock.kind !== 'TEST_ONLY')
    return failure(
      method,
      'UNVERIFIED',
      ['SYSTEM_CLOCK_DIAGNOSTIC_ONLY'],
      details,
    );
  return Object.freeze({
    ...method,
    status: 'VERIFIED',
    scope: 'TEST_ONLY',
    verificationTimestamp: clock.timestamp,
    trustSourceReference: clock.sourceReference,
    assurance: 'TEST_VALIDITY',
    details,
    diagnosticCodes: Object.freeze(['TEST_TIME_ONLY']),
  });
}
