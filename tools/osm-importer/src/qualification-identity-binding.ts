import { inspectVerifiedGraph } from './qualification-artifact-verifier';
import { inspectVerifiedProfile } from './qualification-profile-verifier';
import { inspectClock } from './qualification-trusted-clock';
import { computeCanonicalEdgeGeometryHash } from './qualification-geometry';
import {
  GEOMETRY_HASH_VERSION,
  QUALIFICATION_POLICY_VERSION,
} from './qualification-types';
import {
  isNonEmptyString,
  isObject,
  isSha256,
} from './qualification-validation';
import {
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';

export interface EdgeIdentityBinding {
  readonly graphVersion: string;
  readonly graphArtifactSha256: string;
  readonly edgeId: string;
  readonly osmWayId: number;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly isWayForward: boolean;
  readonly geometryHashVersion: typeof GEOMETRY_HASH_VERSION;
  readonly canonicalGeometryHash: string;
  readonly targetVehicleProfileId: string;
  readonly targetVehicleProfileVersion: string;
  readonly vehicleConfigurationSha256: string;
  readonly qualificationPolicyVersion: typeof QUALIFICATION_POLICY_VERSION;
}
export function verifyEdgeIdentity(
  input: {
    readonly binding: unknown;
    readonly graphVerification?: unknown;
    readonly profileVerification?: unknown;
  },
  reading: unknown,
): VerificationResult<EdgeIdentityBinding> {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'GRAPH_EDGE_PROFILE_BINDING',
        'edge-binding',
        clock?.timestamp ?? null,
        null,
        'TEST_ONLY',
      ),
      method: 'AUTHENTICATED_BYTES_AND_EXACT_NODE_ENDPOINTS',
    };
  try {
    const b = input.binding;
    if (
      !isObject(b) ||
      ![
        'graphVersion',
        'edgeId',
        'fromNodeId',
        'toNodeId',
        'targetVehicleProfileId',
        'targetVehicleProfileVersion',
      ].every((k) => isNonEmptyString(b[k])) ||
      ![
        'graphArtifactSha256',
        'canonicalGeometryHash',
        'vehicleConfigurationSha256',
      ].every((k) => isSha256(b[k])) ||
      !Number.isSafeInteger(b.osmWayId) ||
      Number(b.osmWayId) <= 0 ||
      typeof b.isWayForward !== 'boolean'
    )
      return failure(meta, 'INVALID', ['BINDING_SCHEMA_INVALID']);
    if (b.geometryHashVersion !== GEOMETRY_HASH_VERSION)
      return failure(meta, 'INVALID', ['GEOMETRY_HASH_VERSION_MISMATCH']);
    if (b.qualificationPolicyVersion !== QUALIFICATION_POLICY_VERSION)
      return failure(meta, 'INVALID', [
        'QUALIFICATION_POLICY_VERSION_MISMATCH',
      ]);
    const context = inspectVerifiedGraph(input.graphVerification, reading);
    if (!context)
      return failure(meta, 'UNVERIFIED', [
        'VERIFIED_GRAPH_CONTEXT_UNAVAILABLE_OR_FORGED',
      ]);
    const profile = inspectVerifiedProfile(input.profileVerification, reading);
    if (!profile)
      return failure(meta, 'UNVERIFIED', [
        'VERIFIED_PROFILE_CONTEXT_UNAVAILABLE_OR_FORGED',
      ]);
    if (
      b.graphVersion !== context.graph.graphVersion ||
      b.graphArtifactSha256 !== context.details.computedDigest
    )
      return failure(meta, 'INVALID', ['GRAPH_ARTIFACT_IDENTITY_MISMATCH']);
    const edge = context.graph.edges.find((e) => e.id === b.edgeId);
    if (!edge) return failure(meta, 'INVALID', ['EDGE_NOT_IN_GRAPH']);
    const from = context.graph.nodes.find((n) => n.id === edge.fromNodeId),
      to = context.graph.nodes.find((n) => n.id === edge.toNodeId);
    if (!from || !to)
      return failure(meta, 'INVALID', ['EDGE_NODE_NOT_IN_REGISTRY']);
    const first = edge.geometry[0],
      last = edge.geometry[edge.geometry.length - 1];
    // Strict raw-coordinate equality (including -0 == 0), not an inferred node
    // identity from a hash or a tolerance that merges distinct nodes.
    if (
      first.lat !== from.lat ||
      first.lon !== from.lon ||
      last.lat !== to.lat ||
      last.lon !== to.lon
    )
      return failure(meta, 'INVALID', ['GEOMETRY_ENDPOINT_NODE_MISMATCH']);
    if (
      edge.osmWayId !== b.osmWayId ||
      edge.fromNodeId !== b.fromNodeId ||
      edge.toNodeId !== b.toNodeId ||
      edge.isWayForward !== b.isWayForward
    )
      return failure(meta, 'INVALID', ['DIRECTED_EDGE_IDENTITY_MISMATCH']);
    if (computeCanonicalEdgeGeometryHash(edge) !== b.canonicalGeometryHash)
      return failure(meta, 'INVALID', ['CANONICAL_GEOMETRY_HASH_MISMATCH']);
    const expected = context.qualificationIdentity;
    if (
      b.targetVehicleProfileId !== profile.profileId ||
      b.targetVehicleProfileVersion !== profile.profileVersion ||
      b.vehicleConfigurationSha256 !== profile.configurationSha256 ||
      expected.targetVehicleProfileId !== profile.profileId ||
      expected.targetVehicleProfileVersion !== profile.profileVersion ||
      expected.vehicleConfigurationSha256 !== profile.configurationSha256 ||
      expected.qualificationPolicyVersion !== b.qualificationPolicyVersion
    )
      return failure(meta, 'INVALID', [
        'GRAPH_PROFILE_POLICY_BINDING_MISMATCH',
      ]);
    const details: EdgeIdentityBinding = Object.freeze({
      graphVersion: b.graphVersion as string,
      graphArtifactSha256: b.graphArtifactSha256 as string,
      edgeId: b.edgeId as string,
      osmWayId: b.osmWayId as number,
      fromNodeId: b.fromNodeId as string,
      toNodeId: b.toNodeId as string,
      isWayForward: b.isWayForward,
      geometryHashVersion: GEOMETRY_HASH_VERSION,
      canonicalGeometryHash: b.canonicalGeometryHash as string,
      targetVehicleProfileId: profile.profileId,
      targetVehicleProfileVersion: profile.profileVersion,
      vehicleConfigurationSha256: profile.configurationSha256,
      qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
    });
    return Object.freeze({
      ...meta,
      subjectId: details.edgeId,
      artifactIdentity: Object.freeze({
        sha256: details.graphArtifactSha256,
        version: details.graphVersion,
      }),
      verificationTimestamp: clock!.timestamp!,
      trustSourceReference: `SIGNED_TEST_GRAPH:${details.graphArtifactSha256}`,
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      assurance: 'TEST_IDENTITY_BINDING',
      details,
      diagnosticCodes: Object.freeze([
        'TEST_GRAPH_EDGE_PROFILE_BOUND',
        'NO_PRODUCTION_QUALIFICATION',
      ]),
    });
  } catch {
    return failure(meta, 'INVALID', ['IDENTITY_BINDING_ERROR']);
  }
}
