import { verifyEdgeIdentity } from '../src/qualification-identity-binding';
import {
  baseGraph,
  verificationFixture,
} from './qualification-verification-test-fixtures';

function verify(
  f: ReturnType<typeof verificationFixture>,
  patch: Record<string, unknown> = {},
) {
  return verifyEdgeIdentity(
    {
      binding: { ...f.binding, ...patch },
      graphVerification: f.graphVerification,
      profileVerification: f.profileVerification,
    },
    f.reading,
  );
}
describe('5C.2A directed graph/edge/profile binding', () => {
  it('valid edge is bound to authenticated test graph bytes, node registry and profile configuration', () => {
    const f = verificationFixture(),
      r = verify(f);
    expect(r).toMatchObject({
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      assurance: 'TEST_IDENTITY_BINDING',
      qualificationEligible: false,
      productionAuthoritative: false,
      details: f.binding,
    });
  });
  it.each([
    { graphVersion: 'OLD' },
    { graphArtifactSha256: 'a'.repeat(64) },
    { edgeId: 'ABSENT' },
    { osmWayId: 999 },
    { fromNodeId: 'N2' },
    { toNodeId: 'N1' },
    { isWayForward: false },
    { geometryHashVersion: 'legacy-v1' },
    { canonicalGeometryHash: 'a'.repeat(64) },
    { targetVehicleProfileId: 'OTHER' },
    { targetVehicleProfileVersion: '99.0.0' },
    { vehicleConfigurationSha256: 'a'.repeat(64) },
    { qualificationPolicyVersion: 'OLD' },
  ])('binding mismatch %j is not VERIFIED', (patch) => {
    const f = verificationFixture(),
      r = verify(f, patch);
    expect(r.status).toBe('INVALID');
    expect(r.diagnosticCodes.length).toBeGreaterThan(0);
  });
  it('missing graph context is UNVERIFIED', () => {
    const f = verificationFixture();
    expect(
      verifyEdgeIdentity(
        { binding: f.binding, profileVerification: f.profileVerification },
        f.reading,
      ).diagnosticCodes,
    ).toContain('VERIFIED_GRAPH_CONTEXT_UNAVAILABLE_OR_FORGED');
  });
  it('missing profile context is UNVERIFIED', () => {
    const f = verificationFixture();
    expect(
      verifyEdgeIdentity(
        { binding: f.binding, graphVerification: f.graphVerification },
        f.reading,
      ).diagnosticCodes,
    ).toContain('VERIFIED_PROFILE_CONTEXT_UNAVAILABLE_OR_FORGED');
  });
  it('caller-constructed VERIFIED graph/profile objects cannot bypass provenance', () => {
    const f = verificationFixture();
    expect(
      verifyEdgeIdentity(
        {
          binding: f.binding,
          graphVerification: { ...f.graphVerification },
          profileVerification: { ...f.profileVerification },
        },
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
    expect(
      verifyEdgeIdentity(
        {
          binding: f.binding,
          graphVerification: f.graphVerification,
          profileVerification: { ...f.profileVerification },
        },
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
  });
  it('edge from graph referencing a node absent in registry is INVALID', () => {
    const graph = baseGraph();
    graph.nodes.pop();
    const f = verificationFixture({ graph });
    expect(verify(f).diagnosticCodes).toContain('EDGE_NODE_NOT_IN_REGISTRY');
  });
  it('node coordinates must match endpoints even when V2 quantization would hide the difference', () => {
    const graph = baseGraph();
    graph.nodes[0].lat += 1e-9;
    const f = verificationFixture({ graph });
    expect(verify(f).diagnosticCodes).toContain(
      'GEOMETRY_ENDPOINT_NODE_MISMATCH',
    );
  });
  it('geometry ordering inconsistent with endpoint node IDs is INVALID', () => {
    const graph = baseGraph();
    graph.edges[0].geometry.reverse();
    const f = verificationFixture({ graph });
    expect(verify(f).diagnosticCodes).toContain(
      'GEOMETRY_ENDPOINT_NODE_MISMATCH',
    );
  });
  it('changed interior geometry cannot reuse old canonical hash', () => {
    const graph = baseGraph();
    graph.edges[0].geometry.splice(1, 0, { lat: 16.0655, lon: 108.2151 });
    const f = verificationFixture({ graph });
    expect(verify(f).diagnosticCodes).toContain(
      'CANONICAL_GEOMETRY_HASH_MISMATCH',
    );
  });
  it('forward binding cannot be reused on an authenticated reverse edge', () => {
    const graph = baseGraph(),
      e = graph.edges[0];
    graph.edges[0] = {
      ...e,
      id: 'REVERSE',
      fromNodeId: e.toNodeId,
      toNodeId: e.fromNodeId,
      isWayForward: false,
      geometry: [...e.geometry].reverse(),
    };
    const f = verificationFixture({ graph });
    expect(verify(f, { edgeId: 'REVERSE' }).diagnosticCodes).toContain(
      'DIRECTED_EDGE_IDENTITY_MISMATCH',
    );
  });
  it('sidecar-style profile binding must agree with signed graph manifest', () => {
    const f = verificationFixture({
      manifestPatch: {
        qualificationIdentity: { targetVehicleProfileId: 'OTHER' },
      },
    });
    expect(verify(f).diagnosticCodes).toContain(
      'GRAPH_PROFILE_POLICY_BINDING_MISMATCH',
    );
  });
  it.each([
    { isWayForward: undefined },
    { osmWayId: NaN },
    { graphArtifactSha256: 'NOT_A_HASH' },
    { fromNodeId: '' },
  ])('malformed binding %j fails schema', (patch) => {
    expect(verify(verificationFixture(), patch).diagnosticCodes).toContain(
      'BINDING_SCHEMA_INVALID',
    );
  });
});
