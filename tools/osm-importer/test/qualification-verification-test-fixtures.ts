/** Ephemeral keys for isolated unit tests ONLY. Never persisted or production roots.
 * Registry authority IDs below are claims in a TEST_ONLY keyspace; this fixture
 * does not certify any actual government agency.
 */
import { generateKeyPairSync, sign } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createCompleteInput } from './qualification-fixtures';
import {
  ALL_QUALIFICATION_CRITERIA,
  GEOMETRY_HASH_VERSION,
  QUALIFICATION_POLICY_VERSION,
} from '../src/qualification-types';
import {
  canonicalJson,
  rawSha256,
} from '../src/qualification-verification-json';
import { isolatedTestClock } from '../src/qualification-trusted-clock';
import { loadIsolatedTestRegistry } from '../src/qualification-authority-registry';
import {
  DetachedDocumentInput,
  SignedEnvelope,
  verifySignedDocument,
} from '../src/qualification-crypto-verifier';
import {
  profileConfigurationIdentity,
  verifyProfileProvenance,
} from '../src/qualification-profile-verifier';
import { verifyGraphArtifact } from '../src/qualification-artifact-verifier';
import { computeCanonicalEdgeGeometryHash } from '../src/qualification-geometry';

export const TEST_ROOT = generateKeyPairSync('ed25519');
export const TEST_SIGNER = generateKeyPairSync('ed25519');
export const TEST_OTHER_SIGNER = generateKeyPairSync('ed25519');
export const TEST_NOW = '2026-06-01T00:00:00Z';
export const TEST_AUTHORITY = 'SO_GTVT_DANANG';
export const TEST_KEY_ID = 'TEST_ONLY_ED25519_A';
export const bytesOf = (value: unknown): Buffer =>
  Buffer.from(canonicalJson(value), 'utf8');
export const testClock = () => isolatedTestClock(TEST_NOW).read();
export function testAuthority(patch: Record<string, unknown> = {}) {
  return {
    authorityId: TEST_AUTHORITY,
    name: 'ISOLATED TEST AUTHORITY — NO GOVERNMENT CERTIFICATION',
    role: 'TEST_AUTHORITY',
    allowedCriteria: [...ALL_QUALIFICATION_CRITERIA],
    allowedCategories: [
      'GRAPH_MANIFEST',
      'EVIDENCE',
      'EXEMPTION',
      'PROFILE_APPROVAL',
    ],
    keyId: TEST_KEY_ID,
    publicKeyPem: TEST_SIGNER.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString(),
    algorithm: 'Ed25519',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    certificateId: 'TEST_ONLY_CERT_METADATA',
    certificateValidUntil: '2027-12-31T23:59:59Z',
    authorityStatus: 'ACTIVE',
    keyStatus: 'ACTIVE',
    keyValidFrom: '2026-01-01T00:00:00Z',
    keyValidUntil: '2027-12-31T23:59:59Z',
    ...patch,
  };
}
export function testRegistry(
  patch: Record<string, unknown> = {},
  reading: unknown = testClock(),
) {
  const data = {
    schema: 'qualification-test-registry-v2',
    registryVersion: 'test-registry-v2',
    revocationPolicyVersion: 'qualification-test-revocation-v1',
    revocationSnapshotId: 'TEST_REVOCATION_SNAPSHOT_V2',
    revocationSourceStatus: 'AVAILABLE',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-12-31T23:59:59Z',
    revocationCheckedAt: TEST_NOW,
    revokedDocumentIds: [],
    authorities: [testAuthority()],
    ...patch,
  };
  const bytes = bytesOf(data),
    signatureBase64 = sign(null, bytes, TEST_ROOT.privateKey).toString(
      'base64',
    );
  const config = {
    bytes,
    signatureBase64,
    rootPublicKey: TEST_ROOT.publicKey,
    rootReference: 'TEST_ONLY_OUT_OF_BAND_ROOT',
  };
  return { data, config, result: loadIsolatedTestRegistry(config, reading) };
}
export function signedDocument(
  envelope: SignedEnvelope,
  registry: unknown,
  reading: unknown = testClock(),
) {
  const bytes = bytesOf(envelope),
    signatureBase64 = sign(null, bytes, TEST_SIGNER.privateKey).toString(
      'base64',
    );
  const input: DetachedDocumentInput = {
    bytes,
    signatureBase64,
    algorithm: 'Ed25519',
    keyId: TEST_KEY_ID,
    authorityId: envelope.authorityId,
    subjectId: envelope.subjectId,
    category: envelope.category,
    criterion: envelope.criterion,
  };
  return {
    bytes,
    input,
    result: verifySignedDocument(input, registry, reading),
  };
}
export function testEnvelope(
  patch: Partial<SignedEnvelope> = {},
): SignedEnvelope {
  return {
    schema: 'qualification-signed-document-v1',
    subjectId: 'TEST_DOCUMENT',
    authorityId: TEST_AUTHORITY,
    category: 'EVIDENCE',
    criterion: 'STRUCTURAL_LOAD_CAPACITY',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    body: { testOnly: true },
    ...patch,
  };
}
export function baseGraph() {
  const edge = createCompleteInput().edge;
  return {
    contractVersion: '2.1.0',
    graphVersion: 'test_graph_v1',
    nodes: [
      {
        id: edge.fromNodeId,
        osmNodeId: 1,
        lat: edge.geometry[0].lat,
        lon: edge.geometry[0].lon,
        isSynthetic: false,
      },
      {
        id: edge.toNodeId,
        osmNodeId: 2,
        lat: edge.geometry[1].lat,
        lon: edge.geometry[1].lon,
        isSynthetic: false,
      },
    ],
    edges: [edge],
  };
}
export function verificationFixture(
  options: {
    registryPatch?: Record<string, unknown>;
    graph?: unknown;
    representation?: 'JSON' | 'JSON.GZ';
    manifestPatch?: Record<string, unknown>;
  } = {},
) {
  const reading = testClock(),
    registry = testRegistry(options.registryPatch, reading),
    base = createCompleteInput();
  const profile = {
    ...base.vehicleProfile,
    approvalProvenance: {
      ...base.vehicleProfile.approvalProvenance,
      issuingAuthority: 'ISOLATED TEST AUTHORITY',
      authorityRegistryCode: TEST_AUTHORITY,
    },
  };
  const configIdentity = profileConfigurationIdentity(profile);
  const approval = Object.fromEntries(
    Object.entries(profile.approvalProvenance).filter(
      ([k]) => k !== 'documentSha256' && k !== 'digitalSignatureStatus',
    ),
  );
  const approvalDoc = signedDocument(
    testEnvelope({
      subjectId: profile.profileId,
      category: 'PROFILE_APPROVAL',
      criterion: null,
      validUntil: profile.approvalProvenance.effectiveUntil,
      body: {
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        configurationDigestVersion: configIdentity.version,
        configurationSha256: configIdentity.sha256,
        approval,
      },
    }),
    registry.result,
    reading,
  );
  profile.approvalProvenance.documentSha256 = rawSha256(approvalDoc.bytes);
  const profileVerification = verifyProfileProvenance(
    {
      profile,
      documentBytes: approvalDoc.bytes,
      documentVerification: approvalDoc.result,
    },
    reading,
  );
  const graph = options.graph ?? baseGraph(),
    json = bytesOf(graph),
    representation = options.representation ?? 'JSON',
    bytes = representation === 'JSON.GZ' ? gzipSync(json) : json;
  const manifestDoc = signedDocument(
    testEnvelope({
      subjectId: 'TEST_GRAPH_MANIFEST',
      category: 'GRAPH_MANIFEST',
      criterion: null,
      body: {
        graphVersion: 'test_graph_v1',
        bundle: {
          fileName:
            representation === 'JSON.GZ'
              ? 'BaseRoadGraph.json.gz'
              : 'BaseRoadGraph.json',
          sha256: rawSha256(bytes),
        },
        qualificationIdentity: {
          targetVehicleProfileId: profile.profileId,
          targetVehicleProfileVersion: profile.profileVersion,
          vehicleConfigurationSha256: configIdentity.sha256,
          qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
        },
        ...options.manifestPatch,
      },
    }),
    registry.result,
    reading,
  );
  const artifactInput = {
    bytes,
    representation,
    manifestVerification: manifestDoc.result,
  };
  const graphVerification = verifyGraphArtifact(artifactInput, reading);
  const e = base.edge;
  const binding = {
    graphVersion: 'test_graph_v1',
    graphArtifactSha256: rawSha256(bytes),
    edgeId: e.id,
    osmWayId: e.osmWayId,
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    isWayForward: e.isWayForward,
    geometryHashVersion: GEOMETRY_HASH_VERSION,
    canonicalGeometryHash: computeCanonicalEdgeGeometryHash(e),
    targetVehicleProfileId: profile.profileId,
    targetVehicleProfileVersion: profile.profileVersion,
    vehicleConfigurationSha256: configIdentity.sha256,
    qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
  };
  return {
    reading,
    registry,
    profile,
    configIdentity,
    approvalDoc,
    profileVerification,
    graph,
    bytes,
    json,
    representation,
    manifestDoc,
    artifactInput,
    graphVerification,
    binding,
  };
}
