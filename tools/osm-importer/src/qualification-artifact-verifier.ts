import { gunzipSync } from 'node:zlib';
import {
  computeCanonicalEdgeGeometryHash,
  formatCoordinate,
} from './qualification-geometry';
import {
  isFiniteNumber,
  isNonEmptyString,
  isObject,
  isSha256,
} from './qualification-validation';
import { inspectVerifiedDocument } from './qualification-crypto-verifier';
import {
  failure,
  metadata,
  VerificationResult,
} from './qualification-trust-types';
import {
  immutableJson,
  parseJsonBytes,
  rawSha256,
} from './qualification-verification-json';
import { inspectClock } from './qualification-trusted-clock';
import { GeoPoint } from './types';

export interface GraphNodeIdentity {
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
}
export interface GraphEdgeIdentity {
  readonly id: string;
  readonly osmWayId: number;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly isWayForward: boolean;
  readonly lengthMeters: number;
  readonly geometry: readonly GeoPoint[];
}
export interface GraphSnapshot {
  readonly contractVersion: '2.1.0';
  readonly graphVersion: string;
  readonly nodes: readonly GraphNodeIdentity[];
  readonly edges: readonly GraphEdgeIdentity[];
}
export interface ArtifactDetails {
  readonly computedDigest: string;
  readonly claimedDigest: string | null;
  readonly trustedExpectedDigest: string | null;
  readonly actualVersion: string | null;
  readonly representation: 'JSON' | 'JSON.GZ';
}
interface ArtifactState {
  readonly graph: GraphSnapshot;
  readonly documentVerification: unknown;
  readonly details: ArtifactDetails;
  readonly qualificationIdentity: Readonly<Record<string, unknown>>;
}
const artifacts = new WeakMap<object, ArtifactState>();

function graphSnapshot(value: unknown): GraphSnapshot {
  if (
    !isObject(value) ||
    value.contractVersion !== '2.1.0' ||
    !isNonEmptyString(value.graphVersion) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  )
    throw new Error('GRAPH_SCHEMA_INVALID');
  const nodes: GraphNodeIdentity[] = [],
    edges: GraphEdgeIdentity[] = [],
    nodeIds = new Set<string>(),
    edgeIds = new Set<string>();
  for (const n of value.nodes) {
    if (
      !isObject(n) ||
      !isNonEmptyString(n.id) ||
      !/^[A-Za-z0-9_]+$/.test(n.id) ||
      !isFiniteNumber(n.lat) ||
      !isFiniteNumber(n.lon)
    )
      throw new Error('GRAPH_NODE_INVALID');
    formatCoordinate(n.lat, 'lat');
    formatCoordinate(n.lon, 'lon');
    if (nodeIds.has(n.id)) throw new Error('DUPLICATE_NODE_ID');
    nodeIds.add(n.id);
    nodes.push({ id: n.id, lat: n.lat, lon: n.lon });
  }
  for (const e of value.edges) {
    if (
      !isObject(e) ||
      !isNonEmptyString(e.id) ||
      !Number.isSafeInteger(e.osmWayId) ||
      Number(e.osmWayId) <= 0 ||
      !isFiniteNumber(e.lengthMeters) ||
      e.lengthMeters <= 0
    )
      throw new Error('GRAPH_EDGE_INVALID');
    computeCanonicalEdgeGeometryHash(e); // Existing V2 schema and geometry rules.
    if (edgeIds.has(e.id)) throw new Error('DUPLICATE_EDGE_ID');
    edgeIds.add(e.id);
    const geometry = (e.geometry as GeoPoint[]).map((p) => ({
      lat: p.lat,
      lon: p.lon,
    }));
    edges.push({
      id: e.id,
      osmWayId: e.osmWayId as number,
      fromNodeId: e.fromNodeId as string,
      toNodeId: e.toNodeId as string,
      isWayForward: e.isWayForward as boolean,
      lengthMeters: e.lengthMeters,
      geometry,
    });
  }
  return immutableJson({
    contractVersion: '2.1.0',
    graphVersion: value.graphVersion,
    nodes,
    edges,
  });
}
export interface ArtifactInput {
  readonly bytes?: Uint8Array;
  readonly claimedDigest?: string;
  readonly claimedVersion?: string;
  readonly representation: 'JSON' | 'JSON.GZ';
  readonly manifestVerification?: unknown;
}
export function verifyGraphArtifact(
  input: ArtifactInput,
  reading: unknown,
): VerificationResult<ArtifactDetails> {
  const clock = inspectClock(reading);
  let meta = {
    ...metadata(
      'GRAPH_ARTIFACT_INTEGRITY',
      'BaseRoadGraph',
      clock?.timestamp ?? null,
      null,
      'TECHNICAL_ONLY',
    ),
    method: 'SHA256_RAW_ARTIFACT_BYTES',
  };
  let observations: ArtifactDetails | undefined;
  try {
    if (!(input.bytes instanceof Uint8Array))
      return failure(meta, 'UNVERIFIED', ['ARTIFACT_BYTES_MISSING']);
    if (input.bytes.length > 32 * 1024 * 1024)
      return failure(meta, 'INVALID', ['ARTIFACT_SIZE_LIMIT']);
    if (input.representation !== 'JSON' && input.representation !== 'JSON.GZ')
      return failure(meta, 'INVALID', ['ARTIFACT_REPRESENTATION_INVALID']);
    const bytes = Buffer.from(input.bytes),
      computedDigest = rawSha256(bytes);
    meta = {
      ...meta,
      artifactIdentity: Object.freeze({
        sha256: computedDigest,
        representation: input.representation,
      }),
    };
    observations = Object.freeze({
      computedDigest,
      claimedDigest: input.claimedDigest ?? null,
      trustedExpectedDigest: null,
      actualVersion: null,
      representation: input.representation,
    });
    if (input.claimedDigest !== undefined && !isSha256(input.claimedDigest))
      return failure(
        meta,
        'INVALID',
        ['CLAIMED_DIGEST_FORMAT_INVALID'],
        observations,
      );
    if (
      input.claimedDigest !== undefined &&
      input.claimedDigest !== computedDigest
    )
      return failure(
        meta,
        'INVALID',
        ['CLAIMED_DIGEST_MISMATCH'],
        observations,
      );
    const doc = inspectVerifiedDocument(
        input.manifestVerification,
        'GRAPH_MANIFEST',
        reading,
      ),
      body = doc?.envelope.body;
    if (
      body &&
      (!isObject(body.bundle) ||
        !isSha256(body.bundle.sha256) ||
        !isNonEmptyString(body.graphVersion))
    )
      return failure(meta, 'INVALID', ['SIGNED_MANIFEST_SCHEMA_INVALID']);
    const expected =
      body && isObject(body.bundle) ? String(body.bundle.sha256) : null;
    observations = Object.freeze({
      ...observations,
      trustedExpectedDigest: expected,
    });
    if (expected !== null && computedDigest !== expected)
      return failure(
        { ...meta, artifactIdentity: { sha256: computedDigest } },
        'INVALID',
        ['TRUSTED_EXPECTED_DIGEST_MISMATCH'],
        observations,
      );
    if (
      body &&
      isObject(body.bundle) &&
      body.bundle.fileName !==
        (input.representation === 'JSON.GZ'
          ? 'BaseRoadGraph.json.gz'
          : 'BaseRoadGraph.json')
    )
      return failure(meta, 'INVALID', [
        'SIGNED_ARTIFACT_REPRESENTATION_MISMATCH',
      ]);
    const json =
      input.representation === 'JSON.GZ'
        ? gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })
        : bytes;
    const graph = graphSnapshot(parseJsonBytes(json));
    observations = Object.freeze({
      ...observations,
      actualVersion: graph.graphVersion,
    });
    if (
      input.claimedVersion !== undefined &&
      input.claimedVersion !== graph.graphVersion
    )
      return failure(
        meta,
        'INVALID',
        ['CLAIMED_GRAPH_VERSION_MISMATCH'],
        observations,
      );
    if (body && body.graphVersion !== graph.graphVersion)
      return failure(
        meta,
        'INVALID',
        ['SIGNED_GRAPH_VERSION_MISMATCH'],
        observations,
      );
    const details = Object.freeze({
      computedDigest,
      claimedDigest: input.claimedDigest ?? null,
      trustedExpectedDigest: expected,
      actualVersion: graph.graphVersion,
      representation: input.representation,
    });
    if (!doc || !clock?.timestamp)
      return failure(
        {
          ...meta,
          artifactIdentity: {
            sha256: computedDigest,
            version: graph.graphVersion,
            representation: input.representation,
          },
        },
        'UNVERIFIED',
        ['TRUSTED_EXPECTED_DIGEST_UNAVAILABLE'],
        details,
      );
    const result: VerificationResult<ArtifactDetails> = Object.freeze({
      ...meta,
      scope: 'TEST_ONLY',
      artifactIdentity: Object.freeze({
        sha256: computedDigest,
        version: graph.graphVersion,
        representation: input.representation,
      }),
      verificationTimestamp: clock.timestamp,
      trustSourceReference: `SIGNED_TEST_MANIFEST:${doc.documentSha256}`,
      status: 'VERIFIED',
      assurance: 'TEST_BYTE_INTEGRITY',
      details,
      diagnosticCodes: Object.freeze([
        'BYTE_INTEGRITY_ONLY',
        'NO_PRODUCTION_GRAPH_AUTHORIZATION',
      ]),
    });
    artifacts.set(
      result,
      Object.freeze({
        graph,
        documentVerification: input.manifestVerification,
        details,
        qualificationIdentity: immutableJson(
          isObject(body?.qualificationIdentity)
            ? body.qualificationIdentity
            : {},
        ),
      }),
    );
    return result;
  } catch (err: unknown) {
    return failure(meta, 'INVALID', [
      err instanceof Error && /^(GRAPH_|DUPLICATE_)/.test(err.message)
        ? err.message
        : 'ARTIFACT_PARSE_DECOMPRESSION_OR_GEOMETRY_ERROR',
    ]);
  }
}
export function inspectVerifiedGraph(
  result: unknown,
  reading: unknown,
): ArtifactState | undefined {
  const state =
    result !== null && typeof result === 'object'
      ? artifacts.get(result)
      : undefined;
  return state &&
    inspectVerifiedDocument(
      state.documentVerification,
      'GRAPH_MANIFEST',
      reading,
    )
    ? state
    : undefined;
}
