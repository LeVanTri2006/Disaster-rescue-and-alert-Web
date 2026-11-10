import { createTestOnlyVerificationOrchestrator } from '../src/qualification-verification-orchestrator';
import { EdgeIdentityBinding } from '../src/qualification-identity-binding';
import { CriterionEvidenceRecord } from '../src/qualification-types';
import { createMockNotApplicableEvidence } from './qualification-fixtures';
import {
  pipelineFixture,
  assertLocked,
  replaceSignedEvidence,
  resignRegistry,
  pipelineAuthorities,
  signedRecord,
  signEnvelope,
} from './qualification-verification-pipeline-fixtures';
import {
  baseGraph,
  bytesOf,
  testEnvelope,
  TEST_AUTHORITY,
  TEST_NOW,
  TEST_OTHER_SIGNER,
} from './qualification-verification-test-fixtures';
import {
  isolatedTestClock,
  systemDiagnosticClock,
  unavailableTrustedClock,
} from '../src/qualification-trusted-clock';
import { parseJsonBytes } from '../src/qualification-verification-json';
import { isObject } from '../src/qualification-validation';

const runner = (f: ReturnType<typeof pipelineFixture>) =>
  createTestOnlyVerificationOrchestrator(f.context);
function reject(
  f: ReturnType<typeof pipelineFixture>,
  request: unknown,
  code?: string,
) {
  const out = runner(f).verify(request);
  expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
  assertLocked(out);
  if (code) expect(out.diagnosticCodes).toContain(code);
  return out;
}
describe('5C.2B registry and document security', () => {
  it('registry signature invalid', () => {
    const f = pipelineFixture();
    reject(
      f,
      {
        ...f.request,
        registry: {
          ...f.request.registry,
          signatureBase64: Buffer.alloc(64).toString('base64'),
        },
      },
      'REGISTRY_SIGNATURE_INVALID',
    );
  });
  it.each([
    ['authority permission', { allowedCriteria: [] }],
    ['category permission', { allowedCategories: ['GRAPH_MANIFEST'] }],
    ['authority revoked', { authorityStatus: 'REVOKED' }],
    ['authority unknown revocation', { authorityStatus: 'UNKNOWN' }],
    ['key ID unregistered', { keyId: 'DIFFERENT_KEY' }],
    ['authority expired', { validUntil: '2026-05-31T00:00:00Z' }],
    [
      'certificate metadata expired',
      { certificateValidUntil: '2026-05-31T00:00:00Z' },
    ],
  ])('%s refuses full chain', (_label, patch) => {
    const f = pipelineFixture();
    reject(
      f,
      resignRegistry(f, {
        authorities: pipelineAuthorities().map((a) => ({ ...a, ...patch })),
      }),
    );
  });
  it.each([
    ['stale', { revocationCheckedAt: '2026-05-31T22:00:00Z' }],
    ['future snapshot', { revocationCheckedAt: '2026-06-01T00:00:01Z' }],
    ['expired', { validUntil: '2026-05-31T23:59:59Z' }],
    ['invalid UTC', { revocationCheckedAt: '2026-02-30T00:00:00Z' }],
    [
      'duplicate authorities',
      { authorities: [...pipelineAuthorities(), pipelineAuthorities()[0]] },
    ],
    ['document revoked', { revokedDocumentIds: ['BASE-0'] }],
  ])('signed registry %s', (_label, patch) => {
    const f = pipelineFixture();
    reject(f, resignRegistry(f, patch));
  });
  it.each(['manifest', 'approval'] as const)(
    'corrupted %s signature',
    (field) => {
      const f = pipelineFixture();
      reject(
        f,
        {
          ...f.request,
          [field]: {
            ...f.request[field],
            signatureBase64: Buffer.alloc(64).toString('base64'),
          },
        },
        'SIGNATURE_INVALID',
      );
    },
  );
  it.each([
    'publicKey',
    'certificateChain',
    'documentVerification',
    'verified',
  ])('rejects document payload %s injection', (field) => {
    const f = pipelineFixture();
    reject(f, {
      ...f.request,
      manifest: { ...f.request.manifest, [field]: TEST_OTHER_SIGNER.publicKey },
    });
  });
  it.each([
    'rootPublicKey',
    'clock',
    'verifiedContext',
    'manifestVerification',
    'graphVerification',
    'profileVerification',
    'verificationResult',
  ])('refuses caller %s context', (field) => {
    const f = pipelineFixture();
    reject(
      f,
      {
        ...f.request,
        [field]: { status: 'VERIFIED', scope: 'TEST_ONLY', verified: true },
      },
      'PRODUCTION_MODE_OR_PAYLOAD_CONTEXT_REFUSED',
    );
  });
  it('payload root cannot replace configured root', () => {
    const f = pipelineFixture(),
      out = createTestOnlyVerificationOrchestrator({
        ...f.context,
        rootPublicKey: TEST_OTHER_SIGNER.publicKey,
      }).verify(f.request);
    expect(out.state).toBe('REJECTED');
    assertLocked(out);
    expect(out.diagnosticCodes).toContain('REGISTRY_SIGNATURE_INVALID');
  });
  it('receipt from previous pipeline cannot replace raw registry input', () => {
    const f = pipelineFixture(),
      previous = runner(f).verify(f.request);
    for (const registry of [
      previous,
      parseJsonBytes(bytesOf(previous)),
      { ...f.registry.result },
    ])
      reject(f, { ...f.request, registry });
  });
});
describe('5C.2B graph/edge/vehicle binding', () => {
  const bindingPatches: readonly Partial<EdgeIdentityBinding>[] = [
    { graphVersion: 'other-graph' },
    { graphArtifactSha256: 'a'.repeat(64) },
    { edgeId: 'OTHER_EDGE' },
    { osmWayId: 999 },
    { fromNodeId: 'N2' },
    { toNodeId: 'N1' },
    { isWayForward: false },
    { canonicalGeometryHash: 'b'.repeat(64) },
    { targetVehicleProfileId: 'OTHER_PROFILE' },
    { targetVehicleProfileVersion: '2.0.0' },
    { vehicleConfigurationSha256: 'c'.repeat(64) },
  ];
  it.each(bindingPatches)('rejects tuple mismatch %j', (patch) => {
    const f = pipelineFixture();
    reject(f, { ...f.request, binding: { ...f.binding, ...patch } });
  });
  it.each([
    { geometryHashVersion: 'v1' },
    { qualificationPolicyVersion: 'future-policy' },
    { isWayForward: 'true' },
  ])('rejects runtime version/type %j', (patch) => {
    const f = pipelineFixture();
    reject(f, { ...f.request, binding: { ...f.binding, ...patch } });
  });
  it('graph raw byte tampering', () => {
    const f = pipelineFixture();
    reject(
      f,
      {
        ...f.request,
        graph: {
          ...f.request.graph,
          bytes: Buffer.concat([f.bytes, Buffer.from(' ')]),
        },
      },
      'TRUSTED_EXPECTED_DIGEST_MISMATCH',
    );
  });
  it.each(['N1', 'N2'])('signed graph missing node %s', (node) => {
    const original = baseGraph(),
      graph = {
        ...original,
        nodes: original.nodes.filter((n) => n.id !== node),
      };
    const f = pipelineFixture({ graph });
    reject(f, f.request, 'EDGE_NODE_NOT_IN_REGISTRY');
  });
  it('signed graph endpoints disagree with registered nodes', () => {
    const original = baseGraph(),
      graph = {
        ...original,
        nodes: original.nodes.map((n, i) =>
          i ? n : { ...n, lat: n.lat + 0.001 },
        ),
      };
    const f = pipelineFixture({ graph });
    reject(f, f.request, 'GEOMETRY_ENDPOINT_NODE_MISMATCH');
  });
  it('signed manifest version mismatch', () => {
    const f = pipelineFixture({
      manifestPatch: { graphVersion: 'other-version' },
    });
    reject(f, f.request, 'SIGNED_GRAPH_VERSION_MISMATCH');
  });
  it('signed manifest expected digest mismatch', () => {
    const f = pipelineFixture({
      manifestPatch: {
        bundle: { fileName: 'BaseRoadGraph.json', sha256: 'a'.repeat(64) },
      },
    });
    reject(f, f.request, 'TRUSTED_EXPECTED_DIGEST_MISMATCH');
  });
  it.each([
    { profileId: 'OTHER_PROFILE' },
    { profileVersion: '2.0.0' },
    { overallHeightMeters: 5 },
    { status: 'REVOKED' },
  ])('profile claim changed %j', (patch) => {
    const f = pipelineFixture();
    reject(f, { ...f.request, profile: { ...f.profile, ...patch } });
  });
  it('approval expired with valid signature', () => {
    const f = pipelineFixture(),
      approval = signEnvelope(
        testEnvelope({
          category: 'PROFILE_APPROVAL',
          criterion: null,
          subjectId: f.profile.profileId,
          validUntil: '2026-05-31T23:59:59Z',
        }),
      );
    reject(f, { ...f.request, approval }, 'VALIDITY_EXPIRED');
  });
  it('retains independent graph signature and profile signature errors', () => {
    const f = pipelineFixture(),
      bad = Buffer.alloc(64).toString('base64');
    const out = reject(f, {
      ...f.request,
      manifest: { ...f.request.manifest, signatureBase64: bad },
      approval: { ...f.request.approval, signatureBase64: bad },
    });
    expect(out.audit.find((s) => s.stepId === 'manifest')?.status).toBe(
      'INVALID',
    );
    expect(out.audit.find((s) => s.stepId === 'approval')?.status).toBe(
      'INVALID',
    );
    expect(out.audit.find((s) => s.stepId === 'identity')?.status).toBe(
      'BLOCKED',
    );
  });
});
describe('5C.2B evidence authentication, binding, coverage and exemptions', () => {
  const patches: readonly Partial<CriterionEvidenceRecord>[] = [
    { edgeId: 'OTHER_EDGE' },
    { graphVersion: 'OTHER_GRAPH' },
    { graphArtifactSha256: 'f'.repeat(64) },
    { canonicalGeometryHash: 'f'.repeat(64) },
    { criterion: 'AXLE_LOAD_CAPACITY', unit: 't' },
    { validUntil: '2026-05-31T23:59:59Z' },
    { revocationStatus: 'REVOKED' },
    { evaluatedAt: '2026-06-02T00:00:00Z' },
    { spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 3 } },
    {
      spatialScope: {
        scopeType: 'SECTION_SPAN',
        fromOffsetMeters: 0,
        toOffsetMeters: 50,
      },
    },
    { spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 9999 } },
  ];
  it.each(patches)('signed evidence mismatch/expiry/scope %j', (patch) => {
    const f = pipelineFixture();
    reject(f, replaceSignedEvidence(f, 0, patch));
  });
  it('signed evidence binds another profile even when record graph fields match', () => {
    const f = pipelineFixture(),
      evidence = [...f.request.evidence];
    const projection = parseJsonBytes(evidence[0].document.bytes!);
    if (
      !isObject(projection) ||
      !isObject(projection.body) ||
      !isObject(projection.body.record)
    )
      throw new Error('BAD_TEST_FIXTURE');
    evidence[0] = {
      ...evidence[0],
      document: signEnvelope(
        testEnvelope({
          subjectId: 'BASE-0',
          authorityId: TEST_AUTHORITY,
          criterion: 'LEGAL_ACCESS',
          body: {
            record: projection.body.record,
            binding: { ...f.binding, targetVehicleProfileId: 'OTHER_PROFILE' },
          },
        }),
      ),
    };
    reject(
      f,
      { ...f.request, evidence },
      'SIGNED_RECORD_GRAPH_EDGE_PROFILE_POLICY_BINDING_FAILED',
    );
  });
  it.each(['bytes', 'signature', 'criterion', 'record'])(
    'evidence %s tampering',
    (kind) => {
      const f = pipelineFixture(),
        evidence = [...f.request.evidence],
        item = evidence[0];
      evidence[0] =
        kind === 'record'
          ? { ...item, record: { ...Object(item.record), booleanValue: false } }
          : {
              ...item,
              document: {
                ...item.document,
                ...(kind === 'bytes'
                  ? { bytes: Buffer.from('changed bytes') }
                  : kind === 'signature'
                    ? { signatureBase64: Buffer.alloc(64).toString('base64') }
                    : { criterion: 'AXLE_LOAD_CAPACITY' }),
              },
            };
      reject(f, { ...f.request, evidence });
    },
  );
  it('duplicate ID cannot hide a failure and audit remains deterministic', () => {
    const f = pipelineFixture(),
      evidence = [...f.request.evidence, f.request.evidence[0]];
    const a = reject(f, { ...f.request, evidence }, 'DUPLICATE_EVIDENCE_ID');
    expect(
      runner(f).verify({ ...f.request, evidence: evidence.reverse() }),
    ).toEqual(a);
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    'missing criterion index %i is incomplete',
    (index) => {
      const f = pipelineFixture(),
        out = reject(
          f,
          {
            ...f.request,
            evidence: f.request.evidence.filter((_, i) => i !== index),
          },
          'CRITERION_MISSING',
        );
      expect(out.state).toBe('INCOMPLETE');
    },
  );
  it('a signed failing measurement remains a technical failure, not physical proof', () => {
    const f = pipelineFixture(),
      out = runner(f).verify(replaceSignedEvidence(f, 1, { measuredValue: 1 }));
    expect(out.state).toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
    expect(
      out.diagnosticQualification.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE
        .untrustedAssessmentState,
    ).toBe('FAILED');
    expect(out.completeness[1].physicalTruth).toBe('UNVERIFIED');
  });
  it.each([true, false])(
    'exemption cannot erase failing load; authorized=%s',
    (authorized) => {
      const f = pipelineFixture(),
        request = replaceSignedEvidence(f, 3, { measuredValue: 1 });
      const ex = signedRecord(
        createMockNotApplicableEvidence({
          evidenceId: 'EXEMPT_LOAD',
          criterion: 'STRUCTURAL_LOAD_CAPACITY',
          edgeId: f.binding.edgeId,
          canonicalGeometryHash: f.binding.canonicalGeometryHash,
          graphVersion: f.binding.graphVersion,
          graphArtifactSha256: f.binding.graphArtifactSha256,
          sourceAuthorityId: authorized
            ? TEST_AUTHORITY
            : 'UNREGISTERED_AUTHORITY',
        }),
        f.binding,
        'EXEMPTION',
      );
      const out = reject(
        f,
        { ...request, exemptions: [ex] },
        'EXEMPTION_APPLICATION_UNAVAILABLE_NOT_APPLIED',
      );
      expect(
        out.diagnosticQualification.criteriaResults.STRUCTURAL_LOAD_CAPACITY
          .untrustedAssessmentState,
      ).toBe('FAILED');
      if (authorized)
        expect(
          out.audit.find((s) => s.stepId === 'exemption:0000:authenticity')
            ?.status,
        ).toBe('VERIFIED');
      else
        expect(out.diagnosticCodes).toContain(
          'AUTHORITY_OR_KEY_NOT_REGISTERED',
        );
    },
  );
});
describe('5C.2B clock lifecycle', () => {
  it.each([
    '2026-05-31T23:59:59Z',
    'garbage',
    '2026-02-30T00:00:00Z',
    '2026-06-01',
    '2026-06-01T07:00:00+07:00',
  ])('caller time %s refused', (evaluatedAt) => {
    const f = pipelineFixture();
    reject(
      f,
      { ...f.request, evaluatedAt },
      'CALLER_TIME_INVALID_OR_BACKDATED',
    );
  });
  it.each([
    unavailableTrustedClock,
    systemDiagnosticClock,
    {
      read: () => ({
        kind: 'TEST_ONLY' as const,
        timestamp: TEST_NOW,
        sourceReference: 'FORGED',
      }),
    },
  ])('unavailable/system/forged clock never grants trust', (clock) => {
    const f = pipelineFixture(),
      out = createTestOnlyVerificationOrchestrator({
        ...f.context,
        clock,
      }).verify(f.request);
    expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
  });
  it('replaying an old clock reading is rejected', () => {
    const f = pipelineFixture(),
      old = f.context.clock.read(),
      runner = createTestOnlyVerificationOrchestrator({
        ...f.context,
        clock: { read: () => old },
      });
    for (let i = 0; i < 2; i++) {
      const out = runner.verify(f.request);
      expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
      assertLocked(out);
    }
  });
  it.each([
    '2026-06-01T02:00:00Z',
    '2028-01-01T00:00:00Z',
    '2026-05-31T23:59:59Z',
  ])('time moves midway to %s', (timestamp) => {
    const f = pipelineFixture();
    let reads = 0;
    const clock = {
      read: () => isolatedTestClock(++reads > 32 ? timestamp : TEST_NOW).read(),
    };
    const out = createTestOnlyVerificationOrchestrator({
      ...f.context,
      clock,
    }).verify(f.request);
    expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
  });
  it('freshness expires at final revalidation after every evidence initially verified', () => {
    const f = pipelineFixture();
    let reads = 0;
    const baseline = createTestOnlyVerificationOrchestrator({
      ...f.context,
      clock: {
        read: () => {
          reads++;
          return isolatedTestClock(TEST_NOW).read();
        },
      },
    }).verify(f.request);
    expect(baseline.state).toBe('VERIFIED_TEST_ONLY');
    const total = reads;
    reads = 0;
    const out = createTestOnlyVerificationOrchestrator({
      ...f.context,
      clock: {
        read: () =>
          isolatedTestClock(
            ++reads >= total - 11 ? '2026-06-01T02:00:00Z' : TEST_NOW,
          ).read(),
      },
    }).verify(f.request);
    expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
    expect(
      out.audit.filter(
        (s) => s.stepId.endsWith(':authenticity') && s.status === 'VERIFIED',
      ),
    ).toHaveLength(8);
    expect(out.diagnosticCodes).toContain('REGISTRY_REVOCATION_SNAPSHOT_STALE');
  });
  it('evidence expiring between per-document checks and the final shared instant is rejected', () => {
    const f = pipelineFixture();
    let request = f.request;
    for (let i = 0; i < 8; i++) {
      const updated = replaceSignedEvidence(f, i, {
        validUntil: '2026-06-01T00:00:01Z',
      });
      const evidence = [...request.evidence];
      evidence[i] = updated.evidence[i];
      request = { ...request, evidence };
    }
    let reads = 0;
    expect(
      createTestOnlyVerificationOrchestrator({
        ...f.context,
        clock: {
          read: () => {
            reads++;
            return isolatedTestClock(TEST_NOW).read();
          },
        },
      }).verify(request).state,
    ).toBe('VERIFIED_TEST_ONLY');
    const total = reads;
    reads = 0;
    const out = createTestOnlyVerificationOrchestrator({
      ...f.context,
      clock: {
        read: () =>
          isolatedTestClock(
            ++reads >= total - 1 ? '2026-06-01T00:00:02Z' : TEST_NOW,
          ).read(),
      },
    }).verify(request);
    expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
  });
});
