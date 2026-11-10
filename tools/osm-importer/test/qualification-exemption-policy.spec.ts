import { evaluateTestExemption } from '../src/qualification-exemption-policy';
import { verifySignedDocument } from '../src/qualification-crypto-verifier';
import {
  CriterionEvidenceRecord,
  NotApplicableEvidenceRecord,
} from '../src/qualification-types';
import { createTestOnlyVerificationOrchestrator } from '../src/qualification-verification-orchestrator';
import { createMockNotApplicableEvidence } from './qualification-fixtures';
import {
  pipelineFixture,
  signedRecord,
  replaceSignedEvidence,
  requireRecord,
  pipelineAuthorities,
  assertLocked,
} from './qualification-verification-pipeline-fixtures';
import {
  baseGraph,
  TEST_AUTHORITY,
} from './qualification-verification-test-fixtures';

const contextClaim = {
  schema: 'qualification-exemption-context-v1',
  legalBasisReference: 'TEST_ONLY_LEGAL_REFERENCE',
  physicalStructureIdentity: 'TEST_ONLY_STRUCTURE_A',
};
function fixture(
  options: {
    record?: Partial<NotApplicableEvidenceRecord>;
    metadata?: unknown;
    context?: unknown;
    binding?: Record<string, unknown>;
    registryPatch?: Record<string, unknown>;
    evidence?: readonly Partial<CriterionEvidenceRecord>[];
  } = {},
) {
  const f = pipelineFixture({ registryPatch: options.registryPatch });
  const record = createMockNotApplicableEvidence({
    evidenceId: 'TEST_EXEMPTION',
    criterion: 'STRUCTURAL_LOAD_CAPACITY',
    edgeId: f.binding.edgeId,
    canonicalGeometryHash: f.binding.canonicalGeometryHash,
    graphVersion: f.binding.graphVersion,
    graphArtifactSha256: f.binding.graphArtifactSha256,
    ...options.record,
  });
  const ex = signedRecord(record, f.binding, 'EXEMPTION', {
    exemptionContext:
      options.context === undefined ? contextClaim : options.context,
  });
  // A wrong tuple must itself be signed to exercise cross-domain binding.
  let document = ex.document;
  if (options.binding) {
    const parsed = parseJsonBytes(document.bytes!);
    if (!isObject(parsed) || !isObject(parsed.body))
      throw new Error('BAD_TEST_FIXTURE');
    document = signEnvelope(
      testEnvelope({
        category: 'EXEMPTION',
        subjectId: record.evidenceId,
        authorityId: record.sourceAuthorityId,
        criterion: record.criterion,
        validFrom: record.verifiedAt,
        validUntil: record.validUntil,
        body: { ...parsed.body, binding: { ...f.binding, ...options.binding } },
      }),
    );
    // Raw record digest must track the changed signed document.
    ex.record.documentSha256 = rawSha256(document.bytes!);
  }
  const receipt = verifySignedDocument(document, f.registry.result, f.reading);
  const evidence =
    options.evidence === undefined
      ? f.request.evidence
      : options.evidence.map((patch, index) => {
          const source = f.request.evidence.find(
            (item) => requireRecord(item.record).criterion === record.criterion,
          );
          const base = source
            ? requireRecord(source.record)
            : requireRecord(f.request.evidence[3].record);
          return signedRecord(
            { ...base, evidenceId: `POLICY_EVIDENCE_${index}`, ...patch },
            f.binding,
          );
        });
  const evidenceDocuments = evidence.map((item) => ({
    record: item.record,
    documentBytes: item.document.bytes,
    documentVerification: verifySignedDocument(
      item.document,
      f.registry.result,
      f.reading,
    ),
  }));
  const input = {
    registry: f.registry.result,
    record: ex.record,
    document,
    documentBytes: document.bytes,
    documentVerification: receipt,
    binding: f.binding,
    graphVerification: f.graphVerification,
    profileVerification: f.profileVerification,
    profileApprovalVerification: f.approvalDoc.result,
    profile: f.profile,
    edgeMetadata: Object.prototype.hasOwnProperty.call(options, 'metadata')
      ? options.metadata
      : { bridge: false, tunnel: false, highwayType: 'secondary', rawTags: {} },
    evidenceDocuments,
  };
  return {
    f,
    ex: { ...ex, document },
    receipt,
    input,
    evaluate: () => evaluateTestExemption(input, f.reading),
  };
}
import { signEnvelope } from './qualification-verification-pipeline-fixtures';
import {
  parseJsonBytes,
  rawSha256,
} from '../src/qualification-verification-json';
import { isObject } from '../src/qualification-validation';
import { testEnvelope } from './qualification-verification-test-fixtures';
function decision(
  state: string,
  reason: string,
  options: Parameters<typeof fixture>[0] = {},
) {
  const f = fixture(options),
    result = f.evaluate();
  expect(result.state).toBe(state);
  expect(result.diagnosticCodes).toContain(reason);
  expect(result).toMatchObject({
    scope: 'TEST_ONLY',
    productionAuthoritative: false,
    qualificationEligible: false,
    isCredential: false,
    applicability: 'NOT_ESTABLISHED',
    confirmedPhysicalFailure: 'NOT_ESTABLISHED',
  });
  return { ...f, result };
}
describe('5C.2C exemption authenticity does not establish applicability', () => {
  it('native valid signature with no legal/structure proof is indeterminate', () => {
    const f = decision(
      'INDETERMINATE',
      'VERIFIED_LEGAL_BASIS_PROOF_UNAVAILABLE',
    );
    expect(f.result).toMatchObject({
      authenticity: 'VERIFIED',
      authority: 'VERIFIED',
      identity: 'VERIFIED',
      evidenceConflict: 'NONE_OBSERVED',
    });
  });
  it('missing legal basis reference', () => {
    decision('INDETERMINATE', 'LEGAL_BASIS_REFERENCE_MISSING', {
      context: { physicalStructureIdentity: 'STRUCTURE' },
    });
  });
  it('missing physical structure identity', () => {
    decision('INDETERMINATE', 'PHYSICAL_STRUCTURE_IDENTITY_MISSING', {
      context: { legalBasisReference: 'LEGAL' },
    });
  });
  it('complete claimed test-only proof still lacks independently verified legal/structure/survey models', () => {
    const f = decision('INDETERMINATE', 'CLAIMED_PROOF_IS_NOT_VERIFIED_PROOF', {
      context: {
        ...contextClaim,
        proof: {
          verified: true,
          scope: 'TEST_ONLY',
          legalBasisVerified: true,
          structureSurveyVerified: true,
          fullEdgeCoverage: true,
        },
      },
    });
    expect(f.result.diagnosticCodes).toEqual(
      expect.arrayContaining([
        'VERIFIED_PHYSICAL_STRUCTURE_PROOF_UNAVAILABLE',
        'TRUSTED_SURVEY_COVERAGE_UNAVAILABLE',
      ]),
    );
    expect(f.result.legalBasisReference).toBe(contextClaim.legalBasisReference);
  });
  it('authority category permission is required separately', () => {
    decision('INVALID', 'AUTHORITY_SCOPE_DENIED', {
      registryPatch: {
        authorities: pipelineAuthorities().map((a) => ({
          ...a,
          allowedCategories: ['GRAPH_MANIFEST', 'PROFILE_APPROVAL', 'EVIDENCE'],
        })),
      },
    });
  });
  it.each([
    { graphVersion: 'OTHER_GRAPH' },
    { edgeId: 'OTHER_EDGE' },
    { targetVehicleProfileId: 'OTHER_PROFILE' },
    { targetVehicleProfileVersion: '2.0.0' },
    { vehicleConfigurationSha256: 'a'.repeat(64) },
    { qualificationPolicyVersion: 'OTHER_POLICY' },
  ])('signed exemption tuple mismatch %j', (binding) => {
    decision('INVALID', 'EXEMPTION_GRAPH_EDGE_PROFILE_POLICY_MISMATCH', {
      binding,
    });
  });
  it('bridge=false in OSM is insufficient physical proof', () => {
    decision('INDETERMINATE', 'OSM_BRIDGE_FALSE_IS_NOT_NO_STRUCTURE_PROOF');
  });
  it('signed bridge=true document remains authentic but applicability is denied', () => {
    const f = decision('NOT_APPLICABLE', 'BRIDGE_LOAD_EXEMPTION_FORBIDDEN', {
      metadata: { bridge: true, tunnel: false },
    });
    expect(f.result.authenticity).toBe('VERIFIED');
  });
  it('tunnel=true', () => {
    decision('NOT_APPLICABLE', 'TUNNEL_LOAD_EXEMPTION_FORBIDDEN', {
      metadata: { bridge: false, tunnel: true },
    });
  });
  it('missing structure metadata', () => {
    decision('INDETERMINATE', 'STRUCTURE_METADATA_MISSING', {
      metadata: undefined,
    });
  });
  it.each(['culvertPresent', 'hiddenStructurePresent'])(
    'crossing/hidden structure %s overrides OSM false claims',
    (field) => {
      decision('NOT_APPLICABLE', 'CROSSING_OR_HIDDEN_STRUCTURE_UNRESOLVED', {
        context: { ...contextClaim, [field]: true },
      });
    },
  );
  it('highway with a claimed design record is not a verified terrain exemption', () => {
    decision(
      'INDETERMINATE',
      'HIGHWAY_CLASSIFICATION_IS_NOT_VERIFIED_DESIGN_PROOF',
      {
        record: {
          criterion: 'STATIC_TERRAIN_CAPABILITY',
          justificationCode: 'GRADE_SEPARATED_STANDARD_HIGHWAY',
        },
        metadata: { bridge: false, tunnel: false, highwayType: 'motorway' },
        context: { ...contextClaim, proof: { designRecord: 'TEST_DESIGN' } },
      },
    );
  });
  it.each(['track', 'path', 'footway'])(
    '%s terrain cannot use exemption',
    (highwayType) => {
      decision('NOT_APPLICABLE', 'TRACK_PATH_TERRAIN_EXEMPTION_FORBIDDEN', {
        record: {
          criterion: 'STATIC_TERRAIN_CAPABILITY',
          justificationCode: 'GRADE_SEPARATED_STANDARD_HIGHWAY',
        },
        metadata: { bridge: false, tunnel: false, highwayType },
      });
    },
  );
  it('complex mountainous incline veto', () => {
    decision('NOT_APPLICABLE', 'COMPLEX_TERRAIN_EXEMPTION_FORBIDDEN', {
      record: {
        criterion: 'STATIC_TERRAIN_CAPABILITY',
        justificationCode: 'GRADE_SEPARATED_STANDARD_HIGHWAY',
      },
      metadata: {
        bridge: false,
        tunnel: false,
        highwayType: 'secondary',
        rawTags: { incline: '25%' },
      },
    });
  });
  it('a nonexemptible criterion stays authentic but never applicable', () => {
    decision('NOT_APPLICABLE', 'CRITERION_CANNOT_BE_EXEMPTED', {
      record: { criterion: 'LEGAL_ACCESS' },
    });
  });
  it.each([
    ['expired', { validUntil: '2026-05-31T00:00:00Z' }, 'EXEMPTION_EXPIRED'],
    ['revoked', { revocationStatus: 'REVOKED' as const }, 'EXEMPTION_REVOKED'],
  ])('%s exemption is invalid for policy use', (_label, record, reason) => {
    decision('INVALID', reason, { record });
  });
  it('proof receipt swapped for another document is rejected', () => {
    const f = fixture(),
      other = fixture({
        context: {
          ...contextClaim,
          physicalStructureIdentity: 'OTHER_STRUCTURE',
        },
      });
    const result = evaluateTestExemption(
      {
        ...f.input,
        documentVerification: verifySignedDocument(
          other.ex.document,
          f.f.registry.result,
          f.f.reading,
        ),
      },
      f.f.reading,
    );
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain('DOCUMENT_RECEIPT_BYTES_MISMATCH');
  });
  it('forged/prototype/spread receipt never authorizes exemption', () => {
    const f = fixture();
    for (const documentVerification of [
      { ...f.receipt },
      JSON.parse(JSON.stringify(f.receipt)),
      Object.create(f.receipt),
    ]) {
      const result = evaluateTestExemption(
        { ...f.input, documentVerification },
        f.f.reading,
      );
      expect(result.state).not.toBe('APPLICABLE_TEST_ONLY');
      expect(result.authenticity).toBe('UNVERIFIED');
      expect(result.diagnosticCodes).toContain(
        'DOCUMENT_AUTHENTICITY_UNAVAILABLE',
      );
    }
  });
});
describe('5C.2C exemption conflict reconciliation never mutates evidence', () => {
  it.each([
    [
      'FAILED',
      { measuredValue: 1 },
      'CONFLICTING',
      'UNRESOLVED_TEST_MEASUREMENT_FAILURE',
    ],
    [
      'SATISFIED',
      { measuredValue: 20 },
      'INDETERMINATE',
      'VERIFIED_LEGAL_BASIS_PROOF_UNAVAILABLE',
    ],
    [
      'INDETERMINATE',
      { measuredValue: 5.25 },
      'INDETERMINATE',
      'EVIDENCE_MEASUREMENT_INDETERMINATE',
    ],
    [
      'EXPIRED',
      { validUntil: '2026-05-31T00:00:00Z' },
      'INDETERMINATE',
      'EVIDENCE_EXPIRED',
    ],
    [
      'REVOKED',
      { revocationStatus: 'REVOKED' as const },
      'INDETERMINATE',
      'EVIDENCE_REVOKED',
    ],
    ['INVALID', { measuredValue: -1 }, 'INDETERMINATE', 'EVIDENCE_INVALID'],
  ])(
    'evidence %s is reconciled before any exemption decision',
    (_label, evidence, state, reason) => {
      const f = fixture({ evidence: [evidence] }),
        original = JSON.stringify(f.input.evidenceDocuments);
      const result = f.evaluate();
      expect(result.state).toBe(state);
      expect(result.diagnosticCodes).toContain(reason);
      expect(JSON.stringify(f.input.evidenceDocuments)).toBe(original);
      expect(result.evidenceReferences).toHaveLength(1);
    },
  );
  it('two contradictory authenticated PASS measurements remain conflicting', () => {
    const f = decision('CONFLICTING', 'EVIDENCE_CONFLICT_UNRESOLVED', {
      evidence: [{ measuredValue: 20 }, { measuredValue: 30 }],
    });
    expect(f.result.evidenceConflict).toBe('UNRESOLVED_CONFLICT');
  });
  it('incomplete spatial coverage remains indeterminate', () => {
    decision('INDETERMINATE', 'EVIDENCE_SPATIAL_COVERAGE_INCOMPLETE', {
      evidence: [
        { spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 2 } },
      ],
    });
  });
  it('caller assessment flags are not confirmed legal/physical failure or safety', () => {
    const f = fixture(),
      result = evaluateTestExemption(
        {
          ...f.input,
          evidenceDocuments: [
            {
              record: {
                criterion: 'STRUCTURAL_LOAD_CAPACITY',
                state: 'SATISFIED',
                untrustedAssessmentState: 'SATISFIED',
              },
            },
          ],
        },
        f.f.reading,
      );
    expect(result.state).toBe('INDETERMINATE');
    expect(result.diagnosticCodes).toContain('EVIDENCE_INVALID');
    expect(result.confirmedPhysicalFailure).toBe('NOT_ESTABLISHED');
  });
  it('changed same-ID vehicle configuration cannot alter a bottleneck decision', () => {
    const f = fixture({ evidence: [{ measuredValue: 1 }] });
    const result = evaluateTestExemption(
      { ...f.input, profile: { ...f.f.profile, grossWeightTons: 0.1 } },
      f.f.reading,
    );
    expect(result.state).toBe('INDETERMINATE');
    expect(result.diagnosticCodes).toContain(
      'EVIDENCE_VEHICLE_CONTEXT_UNAVAILABLE',
    );
  });
  it('policy decisions are deterministic under evidence permutation and repeated execution', () => {
    const f = fixture({
        evidence: [{ measuredValue: 1 }, { measuredValue: 20 }],
      }),
      expected = f.evaluate();
    expect(
      evaluateTestExemption(
        {
          ...f.input,
          evidenceDocuments: [...f.input.evidenceDocuments].reverse(),
        },
        f.f.reading,
      ),
    ).toEqual(expected);
    expect(f.evaluate()).toEqual(expected);
    expect(Object.isFrozen(expected.diagnosticCodes)).toBe(true);
  });
});
describe('5C.2C exemption policy integration with the locked engine', () => {
  it.each([false, true])(
    'OSM bridge=%s: authenticity/application audit are separate and load failure persists',
    (bridge) => {
      const graph = baseGraph();
      graph.edges[0].metadata.bridge = bridge;
      const f = pipelineFixture({ graph }),
        request = replaceSignedEvidence(f, 3, { measuredValue: 1 });
      const ex = signedRecord(
        createMockNotApplicableEvidence({
          evidenceId: 'PIPELINE_EXEMPT',
          criterion: 'STRUCTURAL_LOAD_CAPACITY',
          edgeId: f.binding.edgeId,
          canonicalGeometryHash: f.binding.canonicalGeometryHash,
          graphVersion: f.binding.graphVersion,
          graphArtifactSha256: f.binding.graphArtifactSha256,
        }),
        f.binding,
        'EXEMPTION',
        { exemptionContext: contextClaim },
      );
      const outcome = createTestOnlyVerificationOrchestrator(f.context).verify({
        ...request,
        exemptions: [ex],
      });
      assertLocked(outcome);
      expect(outcome.state).not.toBe('VERIFIED_TEST_ONLY');
      expect(outcome.exemptionDecisions[0].state).toBe('CONFLICTING');
      expect(outcome.exemptionDecisions[0].diagnosticCodes).toContain(
        'UNRESOLVED_TEST_MEASUREMENT_FAILURE',
      );
      expect(
        outcome.audit.find((s) => s.stepId === 'exemption:0000:authenticity')
          ?.status,
      ).toBe('VERIFIED');
      expect(
        outcome.audit.find((s) => s.stepId === 'exemption:0000:application')
          ?.exemptionDecision,
      ).toBe('CONFLICTING');
      expect(
        outcome.diagnosticQualification.criteriaResults.STRUCTURAL_LOAD_CAPACITY
          .untrustedAssessmentState,
      ).toBe('FAILED');
    },
  );
});
