import { sign } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createTestOnlyVerificationOrchestrator } from '../src/qualification-verification-orchestrator';
import * as artifacts from '../src/qualification-artifact-verifier';
import * as registry from '../src/qualification-authority-registry';
import * as cryptoVerifier from '../src/qualification-crypto-verifier';
import * as profiles from '../src/qualification-profile-verifier';
import * as documents from '../src/qualification-document-verifier';
import { rawSha256 } from '../src/qualification-verification-json';
import {
  pipelineFixture,
  assertLocked,
  signEnvelope,
  recordObject,
} from './qualification-verification-pipeline-fixtures';
import {
  baseGraph,
  testEnvelope,
  TEST_NOW,
  TEST_SIGNER,
} from './qualification-verification-test-fixtures';
import { isolatedTestClock } from '../src/qualification-trusted-clock';

function withRawGraph(
  f: ReturnType<typeof pipelineFixture>,
  bytes: Uint8Array,
  representation: 'JSON' | 'JSON.GZ' = 'JSON',
) {
  const manifest = signEnvelope(
    testEnvelope({
      subjectId: 'TEST_GRAPH_MANIFEST',
      category: 'GRAPH_MANIFEST',
      criterion: null,
      body: {
        graphVersion: f.binding.graphVersion,
        bundle: {
          fileName:
            representation === 'JSON'
              ? 'BaseRoadGraph.json'
              : 'BaseRoadGraph.json.gz',
          sha256: rawSha256(bytes),
        },
        qualificationIdentity: {
          targetVehicleProfileId: f.binding.targetVehicleProfileId,
          targetVehicleProfileVersion: f.binding.targetVehicleProfileVersion,
          vehicleConfigurationSha256: f.binding.vehicleConfigurationSha256,
          qualificationPolicyVersion: f.binding.qualificationPolicyVersion,
        },
      },
    }),
  );
  return {
    ...f.request,
    graph: { bytes, representation },
    manifest,
    binding: { ...f.binding, graphArtifactSha256: rawSha256(bytes) },
  };
}
describe('5C.2B faults are coded failures, never default successes', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([
    ['malformed JSON', Buffer.from('{"contractVersion":')],
    ['invalid UTF8', Buffer.from([0xff, 0xfe])],
    ['JSON null', Buffer.from('null')],
  ])('authenticated graph bytes: %s', (_label, bytes) => {
    const f = pipelineFixture(),
      out = createTestOnlyVerificationOrchestrator(f.context).verify(
        withRawGraph(f, bytes),
      );
    expect(out.state).toBe('REJECTED');
    assertLocked(out);
    expect(out.audit.find((s) => s.stepId === 'graph')?.status).toBe('INVALID');
  });
  it('signed digest matches truncated gzip but parsing refuses it', () => {
    const f = pipelineFixture(),
      gz = gzipSync(f.json),
      bytes = gz.subarray(0, gz.length - 5);
    const out = createTestOnlyVerificationOrchestrator(f.context).verify(
      withRawGraph(f, bytes, 'JSON.GZ'),
    );
    expect(out.state).toBe('REJECTED');
    assertLocked(out);
    expect(out.diagnosticCodes).toContain(
      'ARTIFACT_PARSE_DECOMPRESSION_OR_GEOMETRY_ERROR',
    );
  });
  it.each(['edges', 'nodes'] as const)('signed graph duplicate %s', (field) => {
    const base = baseGraph(),
      graph = { ...base, [field]: [...base[field], base[field][0]] },
      f = pipelineFixture({ graph });
    const out = createTestOnlyVerificationOrchestrator(f.context).verify(
      f.request,
    );
    expect(out.state).toBe('REJECTED');
    assertLocked(out);
    expect(out.diagnosticCodes).toContain(
      field === 'edges' ? 'DUPLICATE_EDGE_ID' : 'DUPLICATE_NODE_ID',
    );
  });
  it.each([
    '{',
    '{"x":1,"x":2}',
    '\ufeff{}',
    '{ "schema": "qualification-signed-document-v1" }',
    'null',
  ])('correct signature over malformed/noncanonical document %j', (text) => {
    const f = pipelineFixture(),
      bytes = Buffer.from(text),
      manifest = {
        ...f.request.manifest,
        bytes,
        signatureBase64: sign(null, bytes, TEST_SIGNER.privateKey).toString(
          'base64',
        ),
      };
    const out = createTestOnlyVerificationOrchestrator(f.context).verify({
      ...f.request,
      manifest,
    });
    expect(out.state).toBe('REJECTED');
    assertLocked(out);
  });
  it.each([
    'registry',
    'manifest',
    'graph',
    'profile',
    'approval',
    'binding',
    'evidence',
  ])('missing dependency %s', (field) => {
    const f = pipelineFixture(),
      request: Record<string, unknown> = { ...f.request };
    delete request[field];
    const out = createTestOnlyVerificationOrchestrator(f.context).verify(
      request,
    );
    expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
    expect(out.diagnosticCodes).toContain(
      'CLAIM_MISSING_MALFORMED_OR_PAYLOAD_TRUST_INJECTION',
    );
  });
  it.each([null, undefined, [], 42, 'request'])(
    'invalid request %j remains locked',
    (request) => {
      const f = pipelineFixture(),
        out = createTestOnlyVerificationOrchestrator(f.context).verify(request);
      expect(out.state).toBe('INCOMPLETE');
      assertLocked(out);
    },
  );
  it.each(['registry', 'signature', 'graph', 'profile', 'evidence'])(
    'unexpected %s verifier exception',
    (type) => {
      const f = pipelineFixture(),
        fault = () => {
          throw new Error('DO_NOT_LEAK_PRIVATE_FAULT_DETAILS');
        };
      switch (type) {
        case 'registry':
          jest
            .spyOn(registry, 'loadIsolatedTestRegistry')
            .mockImplementationOnce(fault);
          break;
        case 'signature':
          jest
            .spyOn(cryptoVerifier, 'verifySignedDocument')
            .mockImplementationOnce(fault);
          break;
        case 'graph':
          jest
            .spyOn(artifacts, 'verifyGraphArtifact')
            .mockImplementationOnce(fault);
          break;
        case 'profile':
          jest
            .spyOn(profiles, 'verifyProfileProvenance')
            .mockImplementationOnce(fault);
          break;
        case 'evidence':
          jest
            .spyOn(documents, 'verifyEvidenceDocument')
            .mockImplementationOnce(fault);
          break;
      }
      const out = createTestOnlyVerificationOrchestrator(f.context).verify(
        f.request,
      );
      expect(out.state).toBe('REJECTED');
      assertLocked(out);
      expect(out.diagnosticCodes).toContain('UNEXPECTED_VERIFIER_EXCEPTION');
      expect(JSON.stringify(out.audit)).not.toContain(
        'DO_NOT_LEAK_PRIVATE_FAULT_DETAILS',
      );
    },
  );
  it('copied document receipt loses WeakMap provenance in downstream verifier', () => {
    const f = pipelineFixture(),
      original = cryptoVerifier.verifySignedDocument;
    jest
      .spyOn(cryptoVerifier, 'verifySignedDocument')
      .mockImplementation((...args) => ({ ...original(...args) }));
    const out = createTestOnlyVerificationOrchestrator(f.context).verify(
      f.request,
    );
    expect(out.state).not.toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
    expect(out.diagnosticCodes).toContain(
      'TRUSTED_EXPECTED_DIGEST_UNAVAILABLE',
    );
  });
  it('callback mutation of caller objects after snapshots cannot change authenticated data', () => {
    const f = pipelineFixture();
    let count = 0;
    const out = createTestOnlyVerificationOrchestrator({
      ...f.context,
      clock: {
        read: () => {
          if (++count === 2) {
            f.profile.overallHeightMeters = 99;
            recordObject(f.request.evidence[0].record).booleanValue = false;
            f.bytes.fill(0);
            f.manifestDoc.bytes.fill(0);
          }
          return isolatedTestClock(TEST_NOW).read();
        },
      },
    }).verify(f.request);
    expect(out.state).toBe('VERIFIED_TEST_ONLY');
    assertLocked(out);
    expect(
      out.diagnosticQualification.criteriaResults.LEGAL_ACCESS
        .untrustedAssessmentState,
    ).toBe('SATISFIED');
  });
  it.each([NaN, Infinity, -Infinity])(
    'non-JSON evidence measurement %s fails safely',
    (measuredValue) => {
      const f = pipelineFixture(),
        evidence = [...f.request.evidence];
      evidence[0] = {
        ...evidence[0],
        record: { ...recordObject(evidence[0].record), measuredValue },
      };
      const out = createTestOnlyVerificationOrchestrator(f.context).verify({
        ...f.request,
        evidence,
      });
      expect(out.state).toBe('REJECTED');
      assertLocked(out);
      expect(out.diagnosticCodes).toContain('UNEXPECTED_PIPELINE_EXCEPTION');
    },
  );
  it('clock callback exception is unavailable and never leaks exception text', () => {
    const f = pipelineFixture(),
      out = createTestOnlyVerificationOrchestrator({
        ...f.context,
        clock: {
          read: () => {
            throw new Error('CLOCK_SECRET');
          },
        },
      }).verify(f.request);
    expect(out.state).toBe('VERIFIER_UNAVAILABLE');
    assertLocked(out);
    expect(JSON.stringify(out.audit)).not.toContain('CLOCK_SECRET');
  });
});
