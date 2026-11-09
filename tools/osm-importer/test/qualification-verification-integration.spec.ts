import { createTestOnlyVerificationOrchestrator } from '../src/qualification-verification-orchestrator';
import { ALL_QUALIFICATION_CRITERIA } from '../src/qualification-types';
import {
  pipelineFixture,
  assertLocked,
} from './qualification-verification-pipeline-fixtures';
import { verifyGraphArtifact } from '../src/qualification-artifact-verifier';
import { verifyProfileProvenance } from '../src/qualification-profile-verifier';

describe('5C.2B native full-chain test-only integration', () => {
  it.each(['JSON', 'JSON.GZ'] as const)(
    'verifies registry, graph, profile, eight signed documents (%s)',
    (representation) => {
      const f = pipelineFixture({ representation });
      const outcome = createTestOnlyVerificationOrchestrator(f.context).verify(
        f.request,
      );
      expect(outcome.state).toBe('VERIFIED_TEST_ONLY');
      assertLocked(outcome);
      for (const id of [
        'registry',
        'manifest',
        'approval',
        'graph',
        'profile',
        'identity',
        'final:registry',
        'final:identity',
      ])
        expect(outcome.audit.find((s) => s.stepId === id)?.status).toBe(
          'VERIFIED',
        );
      expect(
        outcome.audit.filter(
          (s) => s.stepId.endsWith(':signature') && s.status === 'VERIFIED',
        ),
      ).toHaveLength(8);
      expect(
        outcome.audit.filter(
          (s) => s.stepId.endsWith(':final') && s.status === 'VERIFIED',
        ),
      ).toHaveLength(8);
      expect(outcome.completeness).toHaveLength(8);
      for (const c of outcome.completeness)
        expect(c).toMatchObject({
          recordCount: 1,
          authenticatedRecordCount: 1,
          declaredFullEdgeCoverage: true,
          actualSurveyCoverage: 'UNVERIFIED',
          physicalTruth: 'UNVERIFIED',
        });
      for (const criterion of ALL_QUALIFICATION_CRITERIA)
        expect(
          outcome.diagnosticQualification.criteriaResults[criterion],
        ).toMatchObject({
          state: 'INDETERMINATE',
          untrustedAssessmentState: 'SATISFIED',
          measurementDecision: 'PASS_CERTAIN',
        });
      expect(Object.isFrozen(outcome)).toBe(true);
      expect(Object.isFrozen(outcome.audit[0].diagnosticCodes)).toBe(true);
    },
  );
  it('repeat and evidence permutations produce exactly identical output', () => {
    const f = pipelineFixture(),
      runner = createTestOnlyVerificationOrchestrator(f.context),
      expected = runner.verify(f.request);
    for (const evidence of [
      f.request.evidence,
      [...f.request.evidence].reverse(),
      [...f.request.evidence.slice(3), ...f.request.evidence.slice(0, 3)],
    ])
      expect(runner.verify({ ...f.request, evidence })).toEqual(expected);
  });
  it.each([true, false, undefined])(
    'production flag %s cannot authorize qualification',
    (requireProductionApproved) => {
      const f = pipelineFixture(),
        request =
          requireProductionApproved === undefined
            ? f.request
            : { ...f.request, requireProductionApproved };
      const out = createTestOnlyVerificationOrchestrator(f.context).verify(
        request,
      );
      expect(out.state).toBe(
        requireProductionApproved ? 'REJECTED' : 'VERIFIED_TEST_ONLY',
      );
      assertLocked(out);
    },
  );
  it('audit summaries and JSON copies cannot be reused as graph/profile receipts', () => {
    const f = pipelineFixture(),
      out = createTestOnlyVerificationOrchestrator(f.context).verify(f.request);
    for (const counterfeit of [
      out,
      JSON.parse(JSON.stringify(out)),
      out.audit,
    ]) {
      expect(
        verifyGraphArtifact(
          { ...f.artifactInput, manifestVerification: counterfeit },
          f.reading,
        ).status,
      ).not.toBe('VERIFIED');
      expect(
        verifyProfileProvenance(
          {
            profile: f.profile,
            documentBytes: f.approvalDoc.bytes,
            documentVerification: counterfeit,
          },
          f.reading,
        ).status,
      ).not.toBe('VERIFIED');
    }
  });
  it('audit contains references and diagnostics, never raw documents, keys or profile details', () => {
    const f = pipelineFixture(),
      out = createTestOnlyVerificationOrchestrator(f.context).verify(f.request),
      json = JSON.stringify(out.audit);
    for (const secret of [
      'BEGIN PRIVATE KEY',
      'BEGIN PUBLIC KEY',
      Buffer.from(f.manifestDoc.bytes).toString('base64'),
      f.profile.approvalProvenance.approvingOfficerName,
    ])
      expect(json).not.toContain(secret);
    for (const s of out.audit)
      for (const field of [
        'stepId',
        'verificationType',
        'subjectIdentity',
        'status',
        'scope',
        'policyVersion',
        'timestamp',
        'diagnosticCodes',
        'inputReference',
        'dependencyReferences',
        'resultReference',
      ])
        expect(s).toHaveProperty(field);
  });
});
