import { validateAuthoritativeProof } from '../src/qualification-proof-validation';
import { evaluateDeclaredSurveyCoverage } from '../src/qualification-proof-coverage';
import { proofFixtures } from './qualification-authoritative-proof-fixtures';

describe('5C.2D authoritative proof claims are schema, never authority', () => {
  it.each(['legal', 'inventory', 'survey'] as const)(
    'valid %s schema remains a declaration',
    (kind) => {
      const f = proofFixtures(),
        result = validateAuthoritativeProof(f[kind]);
      expect(result.valid).toBe(true);
      expect(result.diagnosticCodes).toContain(
        'PROOF_SCHEMA_VALID_NOT_AUTHORITATIVE',
      );
      expect(Object.isFrozen(result.value)).toBe(true);
    },
  );
  it('missing legal reference', () => {
    const f = proofFixtures();
    expect(
      validateAuthoritativeProof({ ...f.legal, legalBasisReference: '' })
        .diagnosticCodes,
    ).toContain('LEGAL_REFERENCE_MISSING');
  });
  it.each([
    ['unit', { unit: 'kg' }, 'SURVEY_UNIT_INVALID'],
    ['uncertainty zero', { uncertainty: 0 }, 'SURVEY_UNCERTAINTY_INVALID'],
    ['uncertainty negative', { uncertainty: -1 }, 'SURVEY_UNCERTAINTY_INVALID'],
    ['method', { method: '' }, 'SURVEY_METHOD_MISSING'],
    ['instrument', { instrumentReference: '' }, 'SURVEY_INSTRUMENT_MISSING'],
    ['calibration', { calibrationReference: '' }, 'SURVEY_CALIBRATION_MISSING'],
    ['surveyor', { surveyorId: '' }, 'SURVEYOR_IDENTITY_MISSING'],
    ['authority', { surveyAuthorityId: '' }, 'SURVEY_AUTHORITY_MISSING'],
    ['provenance', { provenanceReference: '' }, 'SURVEY_PROVENANCE_MISSING'],
    [
      'point outside edge',
      { extent: { kind: 'POINT', offset: 121 } },
      'SURVEY_OUTSIDE_EDGE',
    ],
    [
      'reversed span',
      { extent: { kind: 'SPAN', from: 20, to: 10 } },
      'SURVEY_SPAN_OUTSIDE_OR_REVERSED',
    ],
    [
      'invalid location',
      { location: { lat: 91, lon: 108 } },
      'SURVEY_LOCATION_INVALID',
    ],
    [
      'criterion',
      { criterion: 'PHYSICAL_WIDTH_CLEARANCE' },
      'SURVEY_CRITERION_MISMATCH',
    ],
  ])('%s is rejected with a specific reason', (_label, patch, reason) => {
    const f = proofFixtures(),
      result = validateAuthoritativeProof({
        ...f.survey,
        measurements: [{ ...f.survey.measurements[0], ...patch }],
      });
    expect(result.valid).toBe(false);
    expect(result.diagnosticCodes).toContain(reason);
  });
  it.each([NaN, Infinity, -Infinity])(
    'non-finite measurement %s cannot be normalized silently',
    (value) => {
      const f = proofFixtures(),
        result = validateAuthoritativeProof({
          ...f.survey,
          measurements: [{ ...f.survey.measurements[0], value }],
        });
      expect(result.valid).toBe(false);
      expect(result.diagnosticCodes).toContain('PROOF_JSON_OR_SCHEMA_INVALID');
    },
  );
  it('duplicate structure ID does not become an inventory proof', () => {
    const f = proofFixtures();
    expect(
      validateAuthoritativeProof({
        ...f.inventory,
        structures: [f.inventory.structures[0], f.inventory.structures[0]],
      }).diagnosticCodes,
    ).toContain('DUPLICATE_STRUCTURE_ID');
  });
  it('inventory caller cannot label itself authoritative', () => {
    const f = proofFixtures();
    expect(
      validateAuthoritativeProof({
        ...f.inventory,
        completeness: 'AUTHORITATIVE',
      }).diagnosticCodes,
    ).toContain('SELF_CLAIMED_AUTHORITATIVE_INVENTORY_REJECTED');
  });
  it.each([
    { geometryHashVersion: 'V1' },
    { qualificationPolicyVersion: 'FUTURE_POLICY' },
  ])('no version migration %j', (patch) => {
    const f = proofFixtures(),
      r = validateAuthoritativeProof({
        ...f.legal,
        binding: { ...f.legal.binding, ...patch },
      });
    expect(r.valid).toBe(false);
    expect(r.diagnosticCodes).toEqual(
      expect.arrayContaining([
        patch.geometryHashVersion
          ? 'PROOF_GEOMETRY_VERSION_MISMATCH'
          : 'PROOF_POLICY_MISMATCH',
      ]),
    );
  });
});
describe('5C.2D interval coverage is geometry only', () => {
  const observation = (id: string, from: number, to: number) => ({
    measurementId: id,
    extent: { kind: 'SPAN', from, to },
    disposition: 'ACTIVE',
    finding: 'RECORDED',
    supersedesMeasurementId: null,
  });
  it('two touching spans cover an edge geometrically with no survey authority', () => {
    const out = evaluateDeclaredSurveyCoverage(120, [
      observation('A', 0, 60),
      observation('B', 60, 120),
    ]);
    expect(out.state).toBe('GEOMETRIC_COVERAGE_VALID');
    expect(out.authoritativeCoverage).toBe('UNVERIFIED');
    expect(out.physicalTruth).toBe('UNVERIFIED');
  });
  it.each([0, -1, NaN, Infinity])('invalid edge length %s', (length) => {
    const out = evaluateDeclaredSurveyCoverage(length, []);
    expect(out.state).toBe('INVALID');
    expect(out.diagnosticCodes).toContain('COVERAGE_EDGE_LENGTH_INVALID');
  });
  it('gap is not hidden by whole-edge declarations', () => {
    const out = evaluateDeclaredSurveyCoverage(120, [
      observation('A', 0, 59),
      observation('B', 60, 120),
    ]);
    expect(out.state).toBe('INCOMPLETE');
    expect(out.gaps).toEqual([{ from: 59, to: 60 }]);
    expect(out.diagnosticCodes).toContain('GEOMETRIC_COVERAGE_INCOMPLETE');
  });
  it('point never covers an edge', () => {
    const out = evaluateDeclaredSurveyCoverage(120, [
      {
        measurementId: 'P',
        extent: { kind: 'POINT', offset: 60 },
        disposition: 'ACTIVE',
      },
    ]);
    expect(out.state).toBe('INCOMPLETE');
    expect(out.diagnosticCodes).toContain('POINT_IS_NOT_FULL_EDGE_COVERAGE');
  });
  it('FULL_EDGE string is not supporting observations', () => {
    const out = evaluateDeclaredSurveyCoverage(120, [
      {
        measurementId: 'P',
        extent: { kind: 'FULL_EDGE' },
        disposition: 'ACTIVE',
      },
    ]);
    expect(out.state).toBe('INVALID');
    expect(out.diagnosticCodes).toContain('SURVEY_EXTENT_KIND_INVALID');
  });
  it('invalid replacement cannot erase old bottleneck or contribute coverage', () => {
    const out = evaluateDeclaredSurveyCoverage(120, [
      { ...observation('OLD', 0, 30), finding: 'SUSPECTED_BOTTLENECK' },
      {
        ...observation('NEW', 0, 120),
        disposition: 'REVOKED',
        supersedesMeasurementId: 'OLD',
      },
    ]);
    expect(out.state).toBe('INCOMPLETE');
    expect(out.bottleneckIds).toEqual(['OLD']);
    expect(out.retainedObservationIds).toEqual(['NEW', 'OLD']);
    expect(out.diagnosticCodes).toContain('SUPERSESSION_NOT_APPLIED');
  });
  it('overlapping/permuted intervals are deterministic', () => {
    const records = [observation('B', 40, 120), observation('A', 0, 60)];
    expect(evaluateDeclaredSurveyCoverage(120, records)).toEqual(
      evaluateDeclaredSurveyCoverage(120, records.reverse()),
    );
  });
});
