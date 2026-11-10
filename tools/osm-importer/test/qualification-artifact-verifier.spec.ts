import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  inspectVerifiedGraph,
  verifyGraphArtifact,
} from '../src/qualification-artifact-verifier';
import { rawSha256 } from '../src/qualification-verification-json';
import {
  baseGraph,
  bytesOf,
  verificationFixture,
} from './qualification-verification-test-fixtures';

describe('5C.2A graph raw-byte integrity', () => {
  it('computes standard SHA-256 over supplied raw bytes', () => {
    const f = verificationFixture(),
      r = f.graphVerification;
    expect(r).toMatchObject({
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      assurance: 'TEST_BYTE_INTEGRITY',
      details: {
        computedDigest: createHash('sha256').update(f.bytes).digest('hex'),
        trustedExpectedDigest: rawSha256(f.bytes),
        actualVersion: 'test_graph_v1',
      },
    });
  });
  it.each(['JSON', 'JSON.GZ'] as const)(
    '%s artifact verifies raw representation against a signed test manifest',
    (representation) => {
      const f = verificationFixture({ representation });
      expect(f.graphVerification.status).toBe('VERIFIED');
      expect(
        inspectVerifiedGraph(f.graphVerification, f.reading)?.details
          .representation,
      ).toBe(representation);
    },
  );
  it('JSON and JSON.GZ have different raw digests for the same graph', () => {
    const f = verificationFixture(),
      gz = gzipSync(f.json);
    expect(rawSha256(gz)).not.toBe(rawSha256(f.json));
  });
  it('parsing and reserializing JSON cannot substitute for the raw-byte digest', () => {
    const f = verificationFixture(),
      pretty = Buffer.from(
        JSON.stringify(JSON.parse(f.json.toString()), null, 2),
      );
    expect(
      verifyGraphArtifact({ ...f.artifactInput, bytes: pretty }, f.reading)
        .diagnosticCodes,
    ).toContain('TRUSTED_EXPECTED_DIGEST_MISMATCH');
  });
  it('correctly formatted expected digest in caller payload is only a claim', () => {
    const f = verificationFixture();
    const r = verifyGraphArtifact(
      {
        ...f.artifactInput,
        manifestVerification: undefined,
        claimedDigest: rawSha256(f.bytes),
      },
      f.reading,
    );
    expect(r.status).toBe('UNVERIFIED');
    expect(r.details).toMatchObject({
      computedDigest: rawSha256(f.bytes),
      trustedExpectedDigest: null,
    });
  });
  it('forged signed manifest receipt cannot authenticate an expected digest', () => {
    const f = verificationFixture();
    for (const manifestVerification of [
      { ...f.manifestDoc.result },
      JSON.parse(JSON.stringify(f.manifestDoc.result)),
      { status: 'VERIFIED' },
    ]) {
      expect(
        verifyGraphArtifact(
          { ...f.artifactInput, manifestVerification },
          f.reading,
        ).status,
      ).toBe('UNVERIFIED');
    }
  });
  it('a trusted test expected digest that differs from bytes is INVALID', () => {
    const f = verificationFixture({
      manifestPatch: {
        bundle: { fileName: 'BaseRoadGraph.json', sha256: 'a'.repeat(64) },
      },
    });
    expect(f.graphVerification).toMatchObject({
      status: 'INVALID',
      diagnosticCodes: ['TRUSTED_EXPECTED_DIGEST_MISMATCH'],
    });
  });
  it.each(['truncate', 'tamper'])(
    '%s bytes are rejected without repair',
    (mode) => {
      const f = verificationFixture(),
        bytes = Buffer.from(f.bytes);
      if (mode === 'tamper') bytes[1] ^= 1;
      expect(
        verifyGraphArtifact(
          {
            ...f.artifactInput,
            bytes: mode === 'truncate' ? bytes.subarray(0, -1) : bytes,
          },
          f.reading,
        ).status,
      ).toBe('INVALID');
    },
  );
  it.each(['NOT_A_HASH', 'b'.repeat(64)])(
    'claimed digest %s is validated independently',
    (claimedDigest) => {
      const f = verificationFixture();
      expect(
        verifyGraphArtifact({ ...f.artifactInput, claimedDigest }, f.reading)
          .status,
      ).toBe('INVALID');
    },
  );
  it('claimed version mismatch is INVALID', () => {
    const f = verificationFixture();
    expect(
      verifyGraphArtifact(
        { ...f.artifactInput, claimedVersion: 'old-version' },
        f.reading,
      ).diagnosticCodes,
    ).toContain('CLAIMED_GRAPH_VERSION_MISMATCH');
  });
  it('signed manifest version mismatch is INVALID', () => {
    const f = verificationFixture({
      manifestPatch: { graphVersion: 'wrong-version' },
    });
    expect(f.graphVerification.diagnosticCodes).toContain(
      'SIGNED_GRAPH_VERSION_MISMATCH',
    );
  });
  it('representation label cannot relabel a JSON.GZ as JSON', () => {
    const f = verificationFixture({ representation: 'JSON.GZ' });
    expect(
      verifyGraphArtifact(
        { ...f.artifactInput, representation: 'JSON' },
        f.reading,
      ).diagnosticCodes,
    ).toContain('SIGNED_ARTIFACT_REPRESENTATION_MISMATCH');
  });
  it('malformed JSON or broken gzip yields INVALID, never a VERIFIED default', () => {
    const f = verificationFixture();
    for (const input of [
      { bytes: Buffer.from('{bad'), representation: 'JSON' as const },
      { bytes: Buffer.from('not gzip'), representation: 'JSON.GZ' as const },
    ]) {
      expect(verifyGraphArtifact(input, f.reading).status).toBe('INVALID');
    }
  });
  it('missing bytes yields UNVERIFIED', () => {
    const f = verificationFixture();
    expect(
      verifyGraphArtifact({ ...f.artifactInput, bytes: undefined }, f.reading)
        .status,
    ).toBe('UNVERIFIED');
  });
  it.each([
    'duplicate edge',
    'duplicate node',
    'malformed node',
    'malformed geometry',
  ])('%s is rejected during identity snapshot validation', (kind) => {
    const graph = baseGraph();
    if (kind === 'duplicate edge') graph.edges.push({ ...graph.edges[0] });
    if (kind === 'duplicate node') graph.nodes.push({ ...graph.nodes[0] });
    if (kind === 'malformed node') graph.nodes[0].id = 'N1->N2';
    if (kind === 'malformed geometry')
      graph.edges[0].geometry = [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0 },
      ];
    const f = verificationFixture({ graph });
    expect(f.graphVerification.status).toBe('INVALID');
  });
  it('object copies cannot masquerade as verified graph snapshots', () => {
    const f = verificationFixture();
    expect(
      inspectVerifiedGraph({ ...f.graphVerification }, f.reading),
    ).toBeUndefined();
  });
  it('verified graph snapshot and its internal receipt state cannot be mutated', () => {
    const f = verificationFixture(),
      state = inspectVerifiedGraph(f.graphVerification, f.reading)!;
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.graph.edges[0].geometry[0])).toBe(true);
    expect(() => {
      (state as unknown as { details: unknown }).details = {
        computedDigest: 'forged',
      };
    }).toThrow();
    f.bytes.fill(0);
    expect(
      inspectVerifiedGraph(f.graphVerification, f.reading)?.details
        .computedDigest,
    ).toBe(f.binding.graphArtifactSha256);
  });
});
