import { RescueVehicleProfile } from './qualification-types';
import {
  isObject,
  isValidIsoTimestamp,
  validateVehicleProfile,
} from './qualification-validation';
import { inspectVerifiedDocument } from './qualification-crypto-verifier';
import {
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';
import {
  canonicalJson,
  immutableJson,
  rawSha256,
} from './qualification-verification-json';
import { inspectClock } from './qualification-trusted-clock';

export const VEHICLE_CONFIGURATION_DIGEST_VERSION =
  'rescue-vehicle-configuration-v1' as const;
const configKeys = [
  'profileId',
  'profileName',
  'profileVersion',
  'status',
  'overallHeightMeters',
  'overallWidthMeters',
  'overallLengthMeters',
  'grossWeightTons',
  'maxAxleWeightTons',
  'groundClearanceMeters',
  'fordingDepthMeters',
  'turningRadiusMeters',
  'maxClimbGradientPercent',
  'approachAngleDegrees',
  'departureAngleDegrees',
  'verticalMarginMeters',
  'horizontalMarginMeters',
  'loadSafetyFactor',
  'allowedHighwayTypes',
  'disallowedSurfaceTypes',
  'allowsBridges',
  'allowsTunnels',
] as const;
export function profileConfigurationIdentity(profile: unknown): {
  readonly version: typeof VEHICLE_CONFIGURATION_DIGEST_VERSION;
  readonly canonical: string;
  readonly sha256: string;
} {
  const validation = validateVehicleProfile(profile);
  if (!validation.value)
    throw new Error(`PROFILE_SCHEMA_INVALID:${validation.errors.join(',')}`);
  const p = validation.value,
    configuration = Object.fromEntries(configKeys.map((key) => [key, p[key]]));
  const canonical = canonicalJson({
    version: VEHICLE_CONFIGURATION_DIGEST_VERSION,
    configuration,
  });
  return Object.freeze({
    version: VEHICLE_CONFIGURATION_DIGEST_VERSION,
    canonical,
    sha256: rawSha256(Buffer.from(canonical, 'utf8')),
  });
}
export interface ProfileDetails {
  readonly profileId: string;
  readonly profileVersion: string;
  readonly configurationSha256: string;
  readonly configurationDigestVersion: typeof VEHICLE_CONFIGURATION_DIGEST_VERSION;
  readonly approvalDocumentSha256: string;
}
interface ProfileState {
  readonly details: ProfileDetails;
  readonly documentVerification: unknown;
}
const profiles = new WeakMap<object, ProfileState>();
export function verifyProfileProvenance(
  input: {
    readonly profile: unknown;
    readonly documentBytes?: Uint8Array;
    readonly documentVerification?: unknown;
  },
  reading: unknown,
): VerificationResult<ProfileDetails> {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'PROFILE_PROVENANCE',
        isObject(input) &&
          isObject(input.profile) &&
          typeof input.profile.profileId === 'string'
          ? input.profile.profileId
          : 'UNKNOWN_PROFILE',
        clock?.timestamp ?? null,
        null,
        'TECHNICAL_ONLY',
      ),
      method: 'CANONICAL_CONFIGURATION_AND_SIGNED_APPROVAL',
    };
  try {
    const validation = validateVehicleProfile(input.profile, {
      evaluatedAt: clock?.timestamp ?? undefined,
    });
    if (!validation.value) {
      const prov =
        isObject(input.profile) && isObject(input.profile.approvalProvenance)
          ? input.profile.approvalProvenance
          : undefined;
      if (
        isObject(input.profile) &&
        (input.profile.status === 'REVOKED' ||
          prov?.revocationStatus === 'REVOKED_SAFETY_NOTICE')
      )
        return failure(meta, 'REVOKED', [
          ...validation.errors,
          'PROFILE_REVOKED',
        ]);
      if (
        clock?.timestamp &&
        isValidIsoTimestamp(prov?.effectiveUntil) &&
        Date.parse(clock.timestamp) > Date.parse(prov.effectiveUntil)
      )
        return failure(meta, 'EXPIRED', [
          ...validation.errors,
          'PROFILE_APPROVAL_EXPIRED',
        ]);
      return failure(meta, 'INVALID', validation.errors);
    }
    const p = validation.value,
      identity = profileConfigurationIdentity(p);
    if (!(input.documentBytes instanceof Uint8Array))
      return failure(meta, 'UNVERIFIED', ['APPROVAL_DOCUMENT_BYTES_MISSING']);
    const digest = rawSha256(Buffer.from(input.documentBytes));
    if (digest !== p.approvalProvenance.documentSha256)
      return failure(meta, 'INVALID', ['APPROVAL_DOCUMENT_DIGEST_MISMATCH']);
    const doc = inspectVerifiedDocument(
      input.documentVerification,
      'PROFILE_APPROVAL',
      reading,
    );
    if (!doc)
      return failure(meta, 'UNVERIFIED', ['APPROVAL_AUTHENTICITY_UNAVAILABLE']);
    if (digest !== doc.documentSha256)
      return failure(meta, 'INVALID', ['APPROVAL_RECEIPT_BYTES_MISMATCH']);
    const e = doc.envelope,
      b = e.body,
      prov = p.approvalProvenance;
    if (
      e.subjectId !== p.profileId ||
      e.authorityId !== prov.authorityRegistryCode ||
      b.profileId !== p.profileId ||
      b.profileVersion !== p.profileVersion
    )
      return failure(meta, 'INVALID', ['PROFILE_APPROVAL_IDENTITY_MISMATCH']);
    if (
      b.configurationDigestVersion !== identity.version ||
      b.configurationSha256 !== identity.sha256
    )
      return failure(meta, 'INVALID', [
        'PROFILE_CONFIGURATION_DIGEST_MISMATCH',
      ]);
    const approval = Object.fromEntries(
      Object.entries(prov).filter(
        ([k]) => k !== 'documentSha256' && k !== 'digitalSignatureStatus',
      ),
    );
    if (
      !isObject(b.approval) ||
      canonicalJson(b.approval) !== canonicalJson(approval) ||
      e.validFrom !== prov.effectiveFrom ||
      e.validUntil !== prov.effectiveUntil
    )
      return failure(meta, 'INVALID', ['PROFILE_APPROVAL_PROVENANCE_MISMATCH']);
    const details = immutableJson({
      profileId: p.profileId,
      profileVersion: p.profileVersion,
      configurationSha256: identity.sha256,
      configurationDigestVersion: identity.version,
      approvalDocumentSha256: digest,
    });
    const result: VerificationResult<ProfileDetails> = Object.freeze({
      ...meta,
      scope: 'TEST_ONLY',
      verificationTimestamp: clock!.timestamp!,
      trustSourceReference: `SIGNED_TEST_APPROVAL:${digest}`,
      artifactIdentity: Object.freeze({
        sha256: digest,
        version: p.profileVersion,
      }),
      status: 'VERIFIED',
      assurance: 'TEST_IDENTITY_BINDING',
      details,
      diagnosticCodes: Object.freeze([
        'TEST_PROFILE_BINDING_ONLY',
        'NO_PRODUCTION_PROFILE_APPROVAL',
      ]),
    });
    profiles.set(
      result,
      Object.freeze({
        details,
        documentVerification: input.documentVerification,
      }),
    );
    return result;
  } catch {
    return failure(meta, 'INVALID', [
      'PROFILE_CANONICALIZATION_OR_BINDING_ERROR',
    ]);
  }
}
export function inspectVerifiedProfile(
  result: unknown,
  reading: unknown,
): ProfileDetails | undefined {
  const state =
    result !== null && typeof result === 'object'
      ? profiles.get(result)
      : undefined;
  return state &&
    inspectVerifiedDocument(
      state.documentVerification,
      'PROFILE_APPROVAL',
      reading,
    )
    ? state.details
    : undefined;
}
