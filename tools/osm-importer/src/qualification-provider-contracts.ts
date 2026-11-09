import { KeyObject } from 'node:crypto';
import { ClockReading } from './qualification-trusted-clock';
export const PROVIDER_KINDS = [
  'AUTHORITY_REGISTRY',
  'TRUST_ROOTS',
  'REVOCATION',
  'TRUSTED_TIME',
  'GRAPH_ARTIFACT',
  'LEGAL_EVIDENCE',
  'STRUCTURE_INVENTORY',
  'SURVEY_EVIDENCE',
  'VEHICLE_APPROVAL',
] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];
export type ProviderAvailability =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED_UNVERIFIED'
  | 'TEST_ONLY'
  | 'UNAVAILABLE'
  | 'INVALID'
  | 'PRODUCTION_VERIFIED';
export interface ProviderDescriptor<K extends ProviderKind = ProviderKind> {
  readonly kind: K;
  readonly providerId: string;
  readonly supportedContractVersions: readonly string[];
  readonly supportedPolicyVersions: readonly string[];
  readonly trustEstablishmentMethod:
    'UNCONFIGURED' | 'ISOLATED_TEST_ROOT' | 'EXTERNAL_AUTHORITY_REQUIRED';
  readonly provenanceReference: string;
  readonly maximumAgeSeconds: number;
  readonly integrityRequirements: readonly (
    | 'RAW_SHA256'
    | 'DETACHED_SIGNATURE'
    | 'RUNTIME_CLOCK_PROVENANCE'
    | 'OUT_OF_BAND_ROOT'
  )[];
  readonly revocationBehavior: 'FAIL_CLOSED';
  readonly missingDataBehavior: 'FAIL_CLOSED';
  readonly auditReferences: readonly string[];
}
export interface SignedProviderArtifact {
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly signatureBase64: string;
  readonly algorithm: 'Ed25519';
  readonly issuerId: string;
  readonly snapshotId: string;
  readonly observedAt: string;
  readonly validUntil: string;
}
export interface ProviderPayloads {
  AUTHORITY_REGISTRY: SignedProviderArtifact;
  TRUST_ROOTS: {
    readonly rootReference: string;
    readonly publicKey: KeyObject;
  };
  REVOCATION: SignedProviderArtifact;
  TRUSTED_TIME: { readonly reading: ClockReading };
  GRAPH_ARTIFACT: SignedProviderArtifact;
  LEGAL_EVIDENCE: SignedProviderArtifact;
  STRUCTURE_INVENTORY: SignedProviderArtifact;
  SURVEY_EVIDENCE: SignedProviderArtifact;
  VEHICLE_APPROVAL: SignedProviderArtifact;
}
export type ProviderReply<T> = Readonly<
  | { state: 'TEST_ONLY'; data: T; auditReference: string }
  | {
      state: Exclude<ProviderAvailability, 'TEST_ONLY'>;
      diagnosticCodes: readonly string[];
    }
>;
export interface ProviderRequest {
  readonly scope: 'TEST_ONLY';
  readonly subjectReference: string;
  readonly expectedContractVersion: string;
}
export interface ProviderContract<K extends ProviderKind> {
  readonly descriptor: ProviderDescriptor<K>;
  read(request: ProviderRequest): Promise<ProviderReply<ProviderPayloads[K]>>;
}
export interface TrustedAuthorityRegistryProvider extends ProviderContract<'AUTHORITY_REGISTRY'> {}
export interface TrustedRootProvisioningProvider extends ProviderContract<'TRUST_ROOTS'> {}
export interface RevocationSnapshotProvider extends ProviderContract<'REVOCATION'> {}
export interface TrustedTimeProvider extends ProviderContract<'TRUSTED_TIME'> {}
export interface TrustedGraphArtifactProvider extends ProviderContract<'GRAPH_ARTIFACT'> {}
export interface LegalEvidenceProvider extends ProviderContract<'LEGAL_EVIDENCE'> {}
export interface PhysicalStructureInventoryProvider extends ProviderContract<'STRUCTURE_INVENTORY'> {}
export interface SurveyEvidenceProvider extends ProviderContract<'SURVEY_EVIDENCE'> {}
export interface VehicleApprovalProvider extends ProviderContract<'VEHICLE_APPROVAL'> {}
/** Explicit non-provider; never reads environment, network or storage. */
export function unconfiguredProofProvider<K extends ProviderKind>(
  kind: K,
): ProviderContract<K> {
  return Object.freeze({
    descriptor: Object.freeze({
      kind,
      providerId: `UNCONFIGURED_${kind}`,
      supportedContractVersions: ['UNCONFIGURED'],
      supportedPolicyVersions: ['UNCONFIGURED'],
      trustEstablishmentMethod: 'UNCONFIGURED' as const,
      provenanceReference: 'NO_SOURCE_CONFIGURED',
      maximumAgeSeconds: 1,
      integrityRequirements: [],
      revocationBehavior: 'FAIL_CLOSED' as const,
      missingDataBehavior: 'FAIL_CLOSED' as const,
      auditReferences: [],
    }),
    read: async () => ({
      state: 'NOT_CONFIGURED' as const,
      diagnosticCodes: ['PROVIDER_NOT_CONFIGURED'],
    }),
  });
}
