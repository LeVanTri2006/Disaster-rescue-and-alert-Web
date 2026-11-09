import { verifyAuthoritativeProofClaim } from '../src/qualification-proof-binding';
import { proofFixtures } from './qualification-authoritative-proof-fixtures';
import {
  multiKeyFixture,
  signProofPacket,
  keyEnvelope,
  signedKeyDocument,
} from './qualification-multikey-test-fixtures';
import { testClock } from './qualification-verification-test-fixtures';
import {
  AuthoritativeProof,
  SurveyProof,
} from '../src/qualification-proof-types';
import { createCompleteInput } from './qualification-fixtures';
import { EdgeQualifier } from '../src/edge-qualifier';
import { rawSha256 } from '../src/qualification-verification-json';
function chain() {
  const f = proofFixtures(),
    crypto = multiKeyFixture(),
    inventory = signProofPacket(f.inventory, crypto);
  const context = {
    registryReceipt: crypto.receipt,
    graphReceipt: f.graph.graphVerification,
    profileReceipt: f.graph.profileVerification,
    binding: f.graph.binding,
    criterion: f.survey.criterion,
    inventoryPacket: inventory,
  };
  return {
    f,
    crypto,
    inventory,
    context,
    evaluate: (proof: AuthoritativeProof) =>
      verifyAuthoritativeProofClaim(
        signProofPacket(proof, crypto),
        context,
        testClock(),
      ),
  };
}
describe('5C.2D native signed proof to graph/edge/structure/profile binding', () => {
  it.each(['legal', 'inventory', 'survey'] as const)(
    '%s signed proof is bound in TEST_ONLY, with no physical/legal approval',
    (kind) => {
      const c = chain(),
        result = c.evaluate(c.f[kind]);
      expect(result.state).toBe('BOUND_TEST_ONLY');
      expect(result.documentAuthenticity).toBe('VERIFIED_TEST_ONLY');
      expect(result.documentIntegrity).toBe('MATCH');
      expect(result.physicalTruth).toBe('UNVERIFIED');
      expect(result.authoritativeCoverage).toBe('UNVERIFIED');
      expect(result.legalApplicability).toBe('UNAVAILABLE');
      expect(result.productionAuthoritative).toBe(false);
      if (kind === 'survey')
        expect(result).toMatchObject({
          measurementRecorded: true,
          measurementAuthenticated: true,
          measurementSpatialBinding: 'CHAINAGE_AND_ENVELOPE_ONLY',
          geometricCoverage: 'GEOMETRIC_COVERAGE_VALID',
        });
    },
  );
  it.each([
    { graphVersion: 'OLD_GRAPH' },
    { graphArtifactSha256: 'c'.repeat(64) },
    { edgeId: 'OTHER_EDGE' },
    { isWayForward: false },
    { targetVehicleProfileId: 'OTHER_PROFILE' },
    { targetVehicleProfileVersion: '2.0.0' },
    { vehicleConfigurationSha256: 'd'.repeat(64) },
  ])('even correctly signed proof cannot cross tuple %j', (patch) => {
    const c = chain(),
      result = c.evaluate({
        ...c.f.survey,
        binding: { ...c.f.survey.binding, ...patch },
      });
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain(
      'PROOF_GRAPH_EDGE_DIRECTION_PROFILE_POLICY_MISMATCH',
    );
  });
  it('wrong requested criterion is rejected independently of signer permissions', () => {
    const c = chain(),
      packet = signProofPacket(c.f.survey, c.crypto);
    const result = verifyAuthoritativeProofClaim(
      packet,
      { ...c.context, criterion: 'AXLE_LOAD_CAPACITY' },
      testClock(),
    );
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain(
      'PROOF_CRITERION_CONTEXT_MISMATCH',
    );
  });
  it('wrong structure document cannot prove legal applicability for another structure', () => {
    const c = chain(),
      result = c.evaluate({ ...c.f.legal, structureId: 'OTHER_STRUCTURE' });
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain('LEGAL_PROOF_WRONG_STRUCTURE');
  });
  it('survey source structure/document mismatch is rejected', () => {
    const c = chain(),
      result = c.evaluate({
        ...c.f.survey,
        measurements: [
          { ...c.f.survey.measurements[0], structureId: 'OTHER_STRUCTURE' },
        ],
      });
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain(
      'SURVEY_WRONG_STRUCTURE_OR_DOCUMENT',
    );
  });
  it('claimed edge length cannot shrink the required coverage', () => {
    const c = chain(),
      result = c.evaluate({ ...c.f.survey, edgeLengthMeters: 121 });
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain(
      'PROOF_EDGE_LENGTH_OR_MEMBERSHIP_MISMATCH',
    );
  });
  it('whole-edge declaration with only a point stays incomplete', () => {
    const c = chain(),
      result = c.evaluate({
        ...c.f.survey,
        measurements: [
          {
            ...c.f.survey.measurements[0],
            extent: { kind: 'POINT', offset: 0 },
          },
        ],
      });
    expect(result.state).toBe('INCOMPLETE');
    expect(result.diagnosticCodes).toContain(
      'FULL_EDGE_CLAIM_WITHOUT_SUPPORTING_OBSERVATIONS',
    );
  });
  it('empty WHOLE_EDGE declaration cannot establish geometry or authoritative coverage', () => {
    const c = chain(),
      result = c.evaluate({ ...c.f.survey, measurements: [] });
    expect(result.state).toBe('INCOMPLETE');
    expect(result.geometricCoverage).toBe('INCOMPLETE');
    expect(result.measurementRecorded).toBe(false);
  });
  it('multiple survey spans cover a structure technically, never authoritatively', () => {
    const c = chain(),
      m = c.f.survey.measurements[0],
      result = c.evaluate({
        ...c.f.survey,
        measurements: [
          { ...m, extent: { kind: 'SPAN', from: 0, to: 60 } },
          {
            ...m,
            measurementId: 'M2',
            extent: { kind: 'SPAN', from: 60, to: 120 },
          },
        ],
      });
    expect(result.state).toBe('BOUND_TEST_ONLY');
    expect(result.geometricCoverage).toBe('GEOMETRIC_COVERAGE_VALID');
    expect(result.authoritativeCoverage).toBe('UNVERIFIED');
  });
  it('valid offsets cannot hide a survey outside the edge geographic envelope', () => {
    const c = chain(),
      result = c.evaluate({
        ...c.f.survey,
        measurements: [
          { ...c.f.survey.measurements[0], location: { lat: 20, lon: 109 } },
        ],
      });
    expect(result.state).toBe('INVALID');
    expect(result.diagnosticCodes).toContain(
      'SURVEY_LOCATION_OUTSIDE_EDGE_ENVELOPE',
    );
  });
  it.each([
    [
      'revoked',
      { revocation: { status: 'REVOKED' as const, reference: 'REV' } },
      'SUBJECT_REVOKED',
    ],
    [
      'expired',
      { validUntil: '2026-05-31T00:00:00Z' },
      'DOCUMENT_OUTSIDE_VALIDITY',
    ],
    [
      'unknown',
      { revocation: { status: 'UNKNOWN' as const, reference: 'REV' } },
      'REVOCATION_CHECK_UNAVAILABLE',
    ],
  ])('%s proof is never current', (_label, patch, reason) => {
    const c = chain(),
      result = c.evaluate({ ...c.f.survey, ...patch });
    expect(result.state).not.toBe('BOUND_TEST_ONLY');
    expect(result.diagnosticCodes).toContain(reason);
  });
  it('issuer/key self-claims cannot create document authenticity', () => {
    const c = chain(),
      packet = signProofPacket(
        {
          ...c.f.survey,
          document: { ...c.f.survey.document, authorityId: 'FAKE_ISSUER' },
        },
        c.crypto,
      );
    const result = verifyAuthoritativeProofClaim(
      packet,
      c.context,
      testClock(),
    );
    expect(result.state).not.toBe('BOUND_TEST_ONLY');
    expect(result.diagnosticCodes).toContain(
      'PROOF_SOURCE_DOCUMENT_IDENTITY_MISMATCH',
    );
  });
  it('proof signature/record swaps and changed bytes are rejected', () => {
    const c = chain(),
      p = signProofPacket(c.f.survey, c.crypto),
      other = signProofPacket(c.f.legal, c.crypto);
    const swapped = verifyAuthoritativeProofClaim(
      { ...p, documentReceipt: other.documentReceipt },
      c.context,
      testClock(),
    );
    expect(swapped.state).toBe('INVALID');
    expect(swapped.diagnosticCodes).toContain(
      'PROOF_SOURCE_DOCUMENT_IDENTITY_MISMATCH',
    );
    const tampered = verifyAuthoritativeProofClaim(
      { ...p, documentBytes: Buffer.from('other') },
      c.context,
      testClock(),
    );
    expect(tampered.state).toBe('INVALID');
    expect(tampered.diagnosticCodes).toContain(
      'PROOF_DOCUMENT_DIGEST_MISMATCH',
    );
  });
  it('bridge=false never erases a culvert in the signed inventory', () => {
    const c = chain(),
      result = c.evaluate(c.f.inventory);
    expect(result.state).toBe('BOUND_TEST_ONLY');
    expect(result.diagnosticCodes).toContain(
      'CROSSING_INVENTORY_OVERRIDES_OSM_ABSENCE_CLAIM',
    );
    expect(result.physicalTruth).toBe('UNVERIFIED');
  });
  it('unresolved structure inventory conflict remains conflicting', () => {
    const c = chain(),
      result = c.evaluate({ ...c.f.inventory, conflictStatus: 'UNRESOLVED' });
    expect(result.state).toBe('CONFLICTING');
    expect(result.diagnosticCodes).toContain(
      'PROOF_DECLARED_CONFLICT_UNRESOLVED',
    );
  });
  it('new survey cannot remove prior bottleneck by a supersession string', () => {
    const c = chain(),
      old: SurveyProof = {
        ...c.f.survey,
        proofId: 'OLD',
        measurements: [
          {
            ...c.f.survey.measurements[0],
            finding: 'SUSPECTED_BOTTLENECK',
            value: 1,
          },
        ],
      },
      oldPacket = signProofPacket(old, c.crypto);
    const next = { ...c.f.survey, proofId: 'NEW', supersedesProofId: 'OLD' },
      result = verifyAuthoritativeProofClaim(
        signProofPacket(next, c.crypto),
        { ...c.context, priorSurveyPackets: [oldPacket] },
        testClock(),
      );
    expect(result.state).toBe('CONFLICTING');
    expect(result.retainedBottleneckIds).toEqual(['M1']);
    expect(result.diagnosticCodes).toContain(
      'PROOF_SUPERSESSION_NOT_AUTHORIZED',
    );
    expect(result.diagnosticCodes).toContain('SURVEY_OBSERVATIONS_CONFLICTING');
    expect(oldPacket.proof.measurements[0].finding).toBe(
      'SUSPECTED_BOTTLENECK',
    );
  });
  it('legal reference does not create verified legal applicability or an exemption', () => {
    const c = chain(),
      result = c.evaluate(c.f.legal);
    expect(result.legalAuthority).toBe('PERMISSION_VERIFIED_TEST_ONLY');
    expect(result.legalApplicability).toBe('UNAVAILABLE');
    expect(result.diagnosticCodes).toContain(
      'LEGAL_BASIS_PROVIDER_UNAVAILABLE',
    );
  });
  it.each([true, false, undefined])(
    'all positive proof data still leaves engine diagnostic, flag=%s',
    (requireProductionApproved) => {
      const c = chain(),
        proof = c.evaluate(c.f.survey),
        input = {
          ...createCompleteInput(),
          requireProductionApproved,
          verifiedProof: proof,
        };
      const result = new EdgeQualifier().qualifyEdge(input);
      expect(proof.state).toBe('BOUND_TEST_ONLY');
      expect(result).toMatchObject({
        purpose: 'DIAGNOSTIC_ONLY',
        trustStatus: 'UNAVAILABLE',
        qualificationStatus: 'UNVERIFIED',
        isProductionApproved: false,
      });
    },
  );
});
