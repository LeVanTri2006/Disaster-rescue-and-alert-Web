import { KeyObject } from 'node:crypto';
import {
  PROVIDER_KINDS,
  ProviderAvailability,
  ProviderKind,
} from './qualification-provider-contracts';
import { inspectClock } from './qualification-trusted-clock';
import {
  isObject,
  isNonEmptyString,
  isValidIsoTimestamp,
  isSha256,
} from './qualification-validation';
import {
  immutableJson,
  rawSha256,
  strictBase64,
} from './qualification-verification-json';
export interface ProviderContractObservation {
  readonly kind: ProviderKind;
  readonly state: Exclude<ProviderAvailability, 'PRODUCTION_VERIFIED'>;
  readonly providerReference: string;
  readonly interfaceImplemented: boolean;
  readonly testOnlyContractVerified: boolean;
  readonly testOnlyIntegrationVerified: false;
  readonly productionConfigurationAvailable: false;
  readonly trustRootsVerified: false;
  readonly realAuthorityDataAvailable: false;
  readonly realFieldEvidenceAvailable: false;
  readonly revocationServicesConfigured: false;
  readonly externalTrustedClockAvailable: false;
  readonly productionIntegrationTested: false;
  readonly independentSafetyAuditCompleted: false;
  readonly productionReady: false;
  readonly diagnosticCodes: readonly string[];
}
const observations = new WeakMap<object, ProviderContractObservation>();
function result(
  kind: ProviderKind,
  state: ProviderContractObservation['state'],
  id: string,
  implemented: boolean,
  tested: boolean,
  codes: readonly string[],
) {
  const value = immutableJson({
    kind,
    state,
    providerReference: `sha256:${rawSha256(Buffer.from(id))}`,
    interfaceImplemented: implemented,
    testOnlyContractVerified: tested,
    testOnlyIntegrationVerified: false as const,
    productionConfigurationAvailable: false as const,
    trustRootsVerified: false as const,
    realAuthorityDataAvailable: false as const,
    realFieldEvidenceAvailable: false as const,
    revocationServicesConfigured: false as const,
    externalTrustedClockAvailable: false as const,
    productionIntegrationTested: false as const,
    independentSafetyAuditCompleted: false as const,
    productionReady: false as const,
    diagnosticCodes: [...new Set(codes)].sort(),
  });
  observations.set(value, value);
  return value;
}
function strings(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(isNonEmptyString) &&
    new Set(v).size === v.length
  );
}
/** Contract exercise only: raw data is never an authority credential. The
 * test-only integration and production columns deliberately require later work. */
export async function runProviderContractTest(
  provider: unknown,
  reading: unknown,
): Promise<ProviderContractObservation> {
  let kind: ProviderKind = 'AUTHORITY_REGISTRY',
    id = 'UNKNOWN_PROVIDER',
    implemented = false;
  try {
    if (!isObject(provider) || !isObject(provider.descriptor))
      return result(kind, 'INVALID', id, false, false, [
        'PROVIDER_INTERFACE_MISSING',
      ]);
    const descriptor = provider.descriptor,
      found = PROVIDER_KINDS.find((k) => k === descriptor.kind);
    if (!found)
      return result(kind, 'INVALID', id, false, false, [
        'PROVIDER_KIND_INVALID',
      ]);
    kind = found;
    if (
      typeof provider.read !== 'function' ||
      !isNonEmptyString(descriptor.providerId) ||
      !strings(descriptor.supportedContractVersions) ||
      !strings(descriptor.supportedPolicyVersions) ||
      !isNonEmptyString(descriptor.provenanceReference) ||
      typeof descriptor.maximumAgeSeconds !== 'number' ||
      !Number.isSafeInteger(descriptor.maximumAgeSeconds) ||
      descriptor.maximumAgeSeconds <= 0 ||
      descriptor.maximumAgeSeconds > 86400 ||
      ![
        'UNCONFIGURED',
        'ISOLATED_TEST_ROOT',
        'EXTERNAL_AUTHORITY_REQUIRED',
      ].includes(String(descriptor.trustEstablishmentMethod)) ||
      descriptor.revocationBehavior !== 'FAIL_CLOSED' ||
      descriptor.missingDataBehavior !== 'FAIL_CLOSED' ||
      !Array.isArray(descriptor.auditReferences) ||
      !descriptor.auditReferences.every(isNonEmptyString) ||
      !Array.isArray(descriptor.integrityRequirements)
    )
      return result(kind, 'INVALID', id, false, false, [
        'PROVIDER_DESCRIPTOR_INVALID',
      ]);
    id = descriptor.providerId;
    implemented = true;
    const reply: unknown = await provider.read({
      scope: 'TEST_ONLY',
      subjectReference: 'CONTRACT_TEST',
      expectedContractVersion: descriptor.supportedContractVersions[0],
    });
    if (!isObject(reply))
      return result(kind, 'INVALID', id, true, false, [
        'PROVIDER_REPLY_INVALID',
      ]);
    if (reply.state === 'PRODUCTION_VERIFIED')
      return result(kind, 'INVALID', id, true, false, [
        'PRODUCTION_VERIFIED_SELF_CLAIM_REJECTED',
      ]);
    if (reply.state !== 'TEST_ONLY') {
      const state = [
        'NOT_CONFIGURED',
        'CONFIGURED_UNVERIFIED',
        'UNAVAILABLE',
        'INVALID',
      ].find((s) => s === reply.state);
      if (!state)
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_AVAILABILITY_INVALID',
        ]);
      return result(
        kind,
        state === 'NOT_CONFIGURED'
          ? 'NOT_CONFIGURED'
          : state === 'CONFIGURED_UNVERIFIED'
            ? 'CONFIGURED_UNVERIFIED'
            : state === 'UNAVAILABLE'
              ? 'UNAVAILABLE'
              : 'INVALID',
        id,
        true,
        false,
        ['PROVIDER_DATA_NOT_VERIFIED'],
      );
    }
    if (!isObject(reply.data) || !isNonEmptyString(reply.auditReference))
      return result(kind, 'INVALID', id, true, false, [
        'PROVIDER_DATA_OR_AUDIT_REFERENCE_MISSING',
      ]);
    const data = reply.data;
    if (kind === 'TRUSTED_TIME') {
      const actual = inspectClock(data.reading);
      if (!actual || actual.kind !== 'TEST_ONLY')
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_CLOCK_PROVENANCE_INVALID',
        ]);
      const reference = inspectClock(reading);
      if (
        !actual.timestamp ||
        reference?.kind !== 'TEST_ONLY' ||
        !reference.timestamp ||
        Date.parse(reference.timestamp) < Date.parse(actual.timestamp) ||
        Date.parse(reference.timestamp) - Date.parse(actual.timestamp) >
          descriptor.maximumAgeSeconds * 1000
      )
        return result(kind, 'UNAVAILABLE', id, true, false, [
          'PROVIDER_CLOCK_STALE_OR_FUTURE',
        ]);
      if (
        !descriptor.integrityRequirements.includes('RUNTIME_CLOCK_PROVENANCE')
      )
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_CLOCK_REQUIREMENT_MISSING',
        ]);
    } else if (kind === 'TRUST_ROOTS') {
      if (
        !(data.publicKey instanceof KeyObject) ||
        data.publicKey.type !== 'public' ||
        data.publicKey.asymmetricKeyType !== 'ed25519' ||
        !isNonEmptyString(data.rootReference)
      )
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_ROOT_CLAIM_INVALID',
        ]);
      if (!descriptor.integrityRequirements.includes('OUT_OF_BAND_ROOT'))
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_ROOT_REQUIREMENT_MISSING',
        ]);
    } else {
      if (
        !(data.bytes instanceof Uint8Array) ||
        !isSha256(data.sha256) ||
        rawSha256(data.bytes) !== data.sha256 ||
        strictBase64(data.signatureBase64)?.length !== 64 ||
        data.algorithm !== 'Ed25519' ||
        !isNonEmptyString(data.issuerId) ||
        !isNonEmptyString(data.snapshotId)
      )
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_ARTIFACT_INTEGRITY_INVALID',
        ]);
      const clock = inspectClock(reading);
      if (
        !clock ||
        clock.kind !== 'TEST_ONLY' ||
        !clock.timestamp ||
        !isValidIsoTimestamp(data.observedAt) ||
        !isValidIsoTimestamp(data.validUntil)
      )
        return result(kind, 'UNAVAILABLE', id, true, false, [
          'PROVIDER_FRESHNESS_TIME_UNAVAILABLE',
        ]);
      const at = Date.parse(clock.timestamp),
        age = at - Date.parse(data.observedAt);
      if (
        age < 0 ||
        age > descriptor.maximumAgeSeconds * 1000 ||
        at > Date.parse(data.validUntil)
      )
        return result(kind, 'UNAVAILABLE', id, true, false, [
          'PROVIDER_DATA_STALE_OR_EXPIRED',
        ]);
      if (
        !descriptor.integrityRequirements.includes('RAW_SHA256') ||
        !descriptor.integrityRequirements.includes('DETACHED_SIGNATURE')
      )
        return result(kind, 'INVALID', id, true, false, [
          'PROVIDER_INTEGRITY_REQUIREMENTS_MISSING',
        ]);
    }
    return result(kind, 'TEST_ONLY', id, true, true, [
      'TEST_ONLY_CONTRACT_ROUNDTRIP',
      'SEMANTIC_SIGNATURE_AND_AUTHORITY_INTEGRATION_NOT_VERIFIED',
      'NO_PRODUCTION_READINESS',
    ]);
  } catch {
    return result(kind, 'UNAVAILABLE', id, implemented, false, [
      'PROVIDER_CONTRACT_EXCEPTION',
    ]);
  }
}
export function evaluateProviderReadiness(receipts: readonly unknown[]) {
  const codes: string[] = [],
    accepted: ProviderContractObservation[] = [];
  for (const receipt of receipts) {
    const state =
      receipt !== null && typeof receipt === 'object'
        ? observations.get(receipt)
        : undefined;
    if (!state) codes.push('PROVIDER_CONTRACT_RECEIPT_FORGED');
    else accepted.push(state);
  }
  for (const kind of PROVIDER_KINDS) {
    if (!accepted.some((s) => s.kind === kind))
      codes.push(`PROVIDER_MISSING:${kind}`);
    if (accepted.filter((s) => s.kind === kind).length > 1)
      codes.push(`PROVIDER_DUPLICATE:${kind}`);
  }
  return immutableJson({
    overallProductionReadiness: 'BLOCKED' as const,
    qualificationStatus: 'UNVERIFIED' as const,
    productionApproved: false as const,
    providers: accepted
      .slice()
      .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0)),
    diagnosticCodes: [
      ...new Set([
        ...codes,
        'PRODUCTION_ROOTS_AUTHORITY_DATA_FIELD_EVIDENCE_TIME_AND_AUDIT_REQUIRED',
      ]),
    ].sort(),
  });
}
