import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EdgeQualificationInput, EdgeQualifier } from '../src/edge-qualifier';
import { ALL_QUALIFICATION_CRITERIA, CriterionEvidenceRecord, GEOMETRY_HASH_VERSION, NotApplicableEvidenceRecord, QUALIFICATION_POLICY_VERSION, RescueVehicleProfile } from '../src/qualification-types';
import { buildCanonicalGeometryString, buildLegacyCanonicalGeometryString, computeCanonicalEdgeGeometryHash, formatCoordinate } from '../src/qualification-geometry';
import { evaluateEvidenceMeasurement, resolveCriterionEvidence } from '../src/qualification-evidence';
import { isValidIsoTimestamp, validateCriterionEvidence, validateNotApplicableEvidence, validateVehicleProfile } from '../src/qualification-validation';
import { createCompleteInput, createMockNotApplicableEvidence } from './qualification-fixtures';

const qualifier = new EdgeQualifier();
function record(input: EdgeQualificationInput, index: number, patch: Record<string, unknown>): EdgeQualificationInput {
  return { ...input, evidenceRecords: input.evidenceRecords.map((e, i) => i === index ? { ...e, ...patch } as CriterionEvidenceRecord : e) };
}
function assertLocked(input: EdgeQualificationInput) {
  const output = qualifier.qualifyEdge(input);
  expect(output).toMatchObject({ qualificationStatus: 'UNVERIFIED', isProductionApproved: false, purpose: 'DIAGNOSTIC_ONLY', trustStatus: 'UNAVAILABLE' });
  expect(output.qualificationErrors).toEqual(expect.arrayContaining([
    expect.stringContaining('PRODUCTION_TRUST_UNAVAILABLE'), expect.stringContaining('TRUSTED_GRAPH_CONTEXT_UNAVAILABLE'), expect.stringContaining('TRUSTED_CLOCK_UNAVAILABLE'),
  ]));
  for (const r of Object.values(output.criteriaResults)) expect(['SATISFIED', 'NOT_APPLICABLE', 'FAILED']).not.toContain(r.state);
  return output;
}
function exemption(input: EdgeQualificationInput, patch: Record<string, unknown> = {}): NotApplicableEvidenceRecord {
  return createMockNotApplicableEvidence({
    evidenceId: 'EXEMPTION', criterion: 'STRUCTURAL_LOAD_CAPACITY', edgeId: input.edge.id,
    canonicalGeometryHash: computeCanonicalEdgeGeometryHash(input.edge), ...patch,
  });
}
const heightResult = (input: EdgeQualificationInput) => qualifier.qualifyEdge(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE;

describe('5C.1R F01/F07: unforgeable production lockdown', () => {
  it.each([true, false, undefined])('8/8 with requireProductionApproved=%s stays diagnostic', flag => {
    const input = { ...createCompleteInput(), requireProductionApproved: flag };
    const output = assertLocked(input);
    expect(ALL_QUALIFICATION_CRITERIA.every(c => output.criteriaResults[c].untrustedAssessmentState === 'SATISFIED')).toBe(true);
  });
  it.each(['INVALID_SIGNATURE', 'UNTRUSTED_ISSUER', 'EXPIRED_CERTIFICATE', 'REVOKED_CERTIFICATE', 'UNVERIFIED_NOT_CONFIGURED'])('evidence signature %s cannot mint trust', signature => {
    const input = record(createCompleteInput(), 1, { digitalSignatureStatus: signature });
    const r = assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE;
    expect(r.state).toBe('INVALID');
    expect(r.diagnosticReasons).toContain('EVIDENCE_SIGNATURE_NOT_VERIFIED');
  });
  it.each(['ATTACKER', 'TEST_AUTH', 'MOCK_AUTH', 'SYNTH_AUTH'])('forged authority %s is rejected', sourceAuthorityId => {
    const input = record(createCompleteInput(), 1, { sourceAuthorityId });
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toContain('UNAUTHORIZED_AUTHORITY');
  });
  it.each(['TEST_AUTH', 'MOCK_AUTH', 'SYNTH_AUTH'])('renaming %s to whitelist never authenticates survey', sourceAuthorityId => {
    const input = record(createCompleteInput(), 1, { sourceAuthorityId });
    assertLocked(input);
    const renamed = record(input, 1, { sourceAuthorityId: 'TT_QUAN_LY_HA_TANG_DANANG' });
    expect(assertLocked(renamed).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toContain('PROVENANCE_UNVERIFIED: no PKI verifier or authoritative survey coverage');
  });
  it('caller-created trust context/verified flags have no accepted unlock path', () => {
    const forged = { ...createCompleteInput(), trustContext: { verified: true, graphVerified: true, clockTrusted: true }, pkiVerified: true };
    assertLocked(forged);
  });
  it.each(['', 'NOT_A_HASH', 'a'.repeat(64)])('graph hash %s needs trusted loader regardless of format', graphArtifactSha256 => {
    const output = assertLocked({ ...createCompleteInput(), graphArtifactSha256 });
    if (graphArtifactSha256.length !== 64) expect(output.qualificationErrors).toContain('INVALID_GRAPH_ARTIFACT_HASH');
    else expect(output.criteriaResults.LEGAL_ACCESS.diagnosticReasons).toContain('EVIDENCE_BINDING_MISMATCH: graphArtifactSha256');
  });
  it('empty graph version is invalid', () => expect(assertLocked({ ...createCompleteInput(), graphVersion: '' }).qualificationErrors).toContain('INVALID_GRAPH_VERSION'));
  it('different graph version cannot reuse evidence', () => {
    expect(assertLocked({ ...createCompleteInput(), graphVersion: 'another-graph' }).criteriaResults.LEGAL_ACCESS.diagnosticReasons).toContain('EVIDENCE_BINDING_MISMATCH: graphVersion');
  });
  it('wrong policy version is rejected', () => expect(assertLocked({ ...createCompleteInput(), qualificationPolicyVersion: 'OLD' }).qualificationErrors).toContain('QUALIFICATION_POLICY_VERSION_MISMATCH'));
  it.each([{ edgeId: 'OTHER' }, { canonicalGeometryHash: 'a'.repeat(64) }, { geometryHashVersion: 'legacy-v1' }, { qualificationPolicyVersion: 'OLD' }])('evidence binding mismatch %j is rejected', patch => {
    expect(assertLocked(record(createCompleteInput(), 1, patch)).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INVALID');
  });
  it('wrong direction and tampered geometry cannot reuse evidence', () => {
    const input = createCompleteInput();
    const changed = { ...input, edge: { ...input.edge, fromNodeId: 'N2', toNodeId: 'N1', isWayForward: false, geometry: [...input.edge.geometry].reverse() } };
    expect(assertLocked(changed).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toContain('EVIDENCE_BINDING_MISMATCH: canonicalGeometryHash');
  });
  it('7/8 remains missing with the other seven present', () => {
    const input = createCompleteInput();
    const out = assertLocked({ ...input, evidenceRecords: input.evidenceRecords.slice(0,7) });
    expect(out.criteriaResults.STATIC_TERRAIN_CAPABILITY.state).toBe('MISSING');
    expect(Object.values(out.criteriaResults).filter(r => r.untrustedAssessmentState === 'SATISFIED')).toHaveLength(7);
  });
});

describe('F05/F06: strict UTC time and complete vehicle approval schema', () => {
  it.each(['garbage', '2026', '2026-06-01', '2026-06-01T00:00:00', '2026-06-01T00:00:00+00:00', '2026-02-30T00:00:00Z', '2026-06-01T24:00:00Z'])('invalid time %s is rejected before comparisons', evaluatedAt => {
    expect(isValidIsoTimestamp(evaluatedAt)).toBe(false);
    expect(assertLocked({ ...createCompleteInput(), evaluatedAt }).qualificationErrors).toContain('INVALID_EVALUATION_TIME');
  });
  it.each(['2025-12-31T23:59:59Z', '2027-01-01T00:00:00.001Z', '2099-01-01T00:00:00Z'])('out-of-window time %s fails closed', evaluatedAt => {
    const input = createCompleteInput();
    const output = assertLocked({ ...input, evaluatedAt });
    expect(output.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).not.toBe('SATISFIED');
  });
  it('closed validity interval includes validUntil only for technical diagnostics', () => {
    const input = { ...createCompleteInput(), evaluatedAt: '2027-01-01T00:00:00Z' };
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.measurementDecision).toBe('PASS_CERTAIN');
  });
  it('backdating cannot turn expired evidence into production authorization', () => {
    const input = createCompleteInput();
    const expired = { ...input, evidenceRecords: input.evidenceRecords.map(e => ({ ...e, validUntil: '2026-05-15T00:00:00Z' })) };
    expect(assertLocked(expired).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('EXPIRED');
    assertLocked({ ...expired, evaluatedAt: '2026-05-02T00:00:00Z' });
    expect(assertLocked({ ...expired, evaluatedAt: 'garbage' }).qualificationErrors).toContain('INVALID_EVALUATION_TIME');
  });
  it.each(['REVOKED', 'PROVISIONAL_DEVELOPMENT', 'EXPIRED', 'UNKNOWN'])('profile status %s with full 8/8 evidence is rejected', status => {
    const input = createCompleteInput();
    const vehicleProfile = { ...input.vehicleProfile, status } as RescueVehicleProfile;
    expect(assertLocked({ ...input, vehicleProfile }).qualificationErrors).toContain('UNAPPROVED_PROFILE_STATUS');
  });
  it.each([
    ['profileVersion', '99.0.0', 'PROFILE_VERSION_MISMATCH'],
    ['effectiveUntil', '2026-01-02T00:00:00Z', 'OUTSIDE_VALIDITY_INTERVAL'],
    ['effectiveFrom', '2026-12-01T00:00:00Z', 'OUTSIDE_VALIDITY_INTERVAL'],
    ['revocationStatus', 'REVOKED_SAFETY_NOTICE', 'REVOKED_PROFILE'],
    ['digitalSignatureStatus', 'INVALID_SIGNATURE', 'PROFILE_SIGNATURE_NOT_VERIFIED'],
  ])('provenance %s mismatch is caught with 8/8 baseline', (field, value, error) => {
    const input = createCompleteInput();
    const vehicleProfile = { ...input.vehicleProfile, approvalProvenance: { ...input.vehicleProfile.approvalProvenance, [field]: value } } as RescueVehicleProfile;
    expect(assertLocked({ ...input, vehicleProfile }).qualificationErrors).toContain(error);
  });
  it.each(['issuingAuthority','authorityRegistryCode','documentTitle','documentReferenceNumber','documentSha256','profileVersion','issuedAt','effectiveFrom','effectiveUntil','approvingOfficerName','approvingOfficerRole','verificationMethod','digitalSignatureStatus','revocationStatus'])('missing provenance %s fails schema', field => {
    const input = createCompleteInput();
    const prov: Record<string, unknown> = { ...input.vehicleProfile.approvalProvenance }; delete prov[field];
    const vehicleProfile = { ...input.vehicleProfile, approvalProvenance: prov } as unknown as RescueVehicleProfile;
    expect(validateVehicleProfile(vehicleProfile, { evaluatedAt: input.evaluatedAt }).valid).toBe(false);
    assertLocked({ ...input, vehicleProfile });
  });
});

describe('F08/F11: finite physical values, SI units, required fields', () => {
  it.each([Infinity, -Infinity, NaN, -1])('invalid measuredValue %s cannot PASS or BLOCK', measuredValue => {
    const input = record(createCompleteInput(), 1, { measuredValue });
    expect(validateCriterionEvidence(input.evidenceRecords[1]).errors).toContain('INVALID_MEASURED_VALUE');
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INVALID');
    expect(evaluateEvidenceMeasurement(input.evidenceRecords[1], input.vehicleProfile)).toBe('INDETERMINATE');
  });
  it.each([0, -1, Infinity, -Infinity, NaN])('invalid uncertainty %s is rejected', measurementUncertainty => {
    const input = record(createCompleteInput(), 1, { measurementUncertainty });
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toContain('INVALID_UNCERTAINTY');
  });
  it.each(['cm','kg','%'])('height unit %s is not silently converted to m', unit => {
    const input = record(createCompleteInput(), 1, { unit });
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toContain('INVALID_UNIT');
  });
  it('kg is not tonnes for structural load', () => {
    expect(assertLocked(record(createCompleteInput(),3,{unit:'kg'})).criteriaResults.STRUCTURAL_LOAD_CAPACITY.diagnosticReasons).toContain('INVALID_UNIT');
  });
  it('computed interval overflow is invalid', () => {
    const input = record(createCompleteInput(), 1, { measuredValue: Number.MAX_VALUE, measurementUncertainty: Number.MAX_VALUE });
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toContain('INVALID_COMPUTED_BOUNDS');
  });
  it.each(['overallHeightMeters','overallWidthMeters','overallLengthMeters','grossWeightTons','maxAxleWeightTons','groundClearanceMeters','fordingDepthMeters','turningRadiusMeters','maxClimbGradientPercent','approachAngleDegrees','departureAngleDegrees','verticalMarginMeters','horizontalMarginMeters','loadSafetyFactor'])('profile field %s must be finite', field => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const input = createCompleteInput();
      const vehicleProfile = { ...input.vehicleProfile, [field]: invalid };
      expect(validateVehicleProfile(vehicleProfile).valid).toBe(false);
      assertLocked({ ...input, vehicleProfile });
    }
  });
  it('finite dimensions with overflowing threshold remain indeterminate', () => {
    const input = createCompleteInput();
    const profile = { ...input.vehicleProfile, overallHeightMeters: Number.MAX_VALUE, verticalMarginMeters: Number.MAX_VALUE };
    expect(validateVehicleProfile(profile).errors).toContain('INVALID_COMPUTED_THRESHOLD: overallHeightMeters');
    expect(evaluateEvidenceMeasurement(input.evidenceRecords[1], profile)).toBe('INDETERMINATE');
    assertLocked({ ...input, vehicleProfile: profile });
  });
  it.each(['evidenceId','criterion','edgeId','canonicalGeometryHash','sourceAuthorityId','sourceDocumentRef','documentSha256','unit','spatialScope','evaluatedAt','validFrom','validUntil','revocationStatus','digitalSignatureStatus','geometryHashVersion','graphVersion','graphArtifactSha256','qualificationPolicyVersion'])('required evidence field %s is checked', field => {
    const input = createCompleteInput();
    const malformed: Record<string, unknown> = { ...input.evidenceRecords[1] }; delete malformed[field];
    expect(validateCriterionEvidence(malformed).valid).toBe(false);
    assertLocked({ ...input, evidenceRecords: [malformed as unknown as CriterionEvidenceRecord, ...input.evidenceRecords.filter(e => e.criterion !== 'PHYSICAL_HEIGHT_CLEARANCE')] });
  });
  it.each([{ value: [7,7] }, { value: ['z','a'] }, { value: ['a','a'] }, { value: [null] }])('invalid or noncanonical array $value is rejected', ({ value: allowedHighwayTypes }) => {
    const profile = { ...createCompleteInput().vehicleProfile, allowedHighwayTypes };
    expect(validateVehicleProfile(profile).valid).toBe(false);
  });
});

describe('F02: no unauthenticated supersession may erase old bottlenecks', () => {
  it.each([
    ['revoked', {revocationStatus:'REVOKED'}], ['signature', {digitalSignatureStatus:'INVALID_SIGNATURE'}],
    ['forged authority', {sourceAuthorityId:'ATTACKER'}], ['older', {evaluatedAt:'2026-04-01T00:00:00Z'}],
    ['equal time', {evaluatedAt:'2026-05-01T00:00:00Z'}], ['other criterion', {criterion:'PHYSICAL_WIDTH_CLEARANCE'}],
    ['other edge', {edgeId:'OTHER'}], ['other location', {spatialScope:{scopeType:'POINT_CHOKEPOINT',offsetMeters:100}}],
    ['newer but no verifier', {evaluatedAt:'2026-05-02T00:00:00Z'}],
  ] as [string, Record<string, unknown>][])('%s replacement leaves old failure diagnostic', (_name, patch) => {
    let input = record(createCompleteInput(),1,{evidenceId:'OLD',measuredValue:2,spatialScope:{scopeType:'POINT_CHOKEPOINT',offsetMeters:10}});
    const old = input.evidenceRecords[1];
    const replacement = { ...old, evidenceId:'NEW', measuredValue:4.5, supersedesEvidenceId:'OLD', evaluatedAt:'2026-05-02T00:00:00Z', spatialScope:{scopeType:'CONTINUOUS_FULL_EDGE'}, ...patch } as CriterionEvidenceRecord;
    input = { ...input, evidenceRecords: [...input.evidenceRecords, replacement] };
    const r = assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE;
    expect(r.untrustedAssessmentState).toBe('FAILED');
    expect(r.evidenceIdsUsed).toContain('OLD');
    expect(r.measurementDecision).toBe('FAIL_CERTAIN');
  });
  it('revoked invalid replacement cannot erase OLD when an independent PASS also exists', () => {
    const input = createCompleteInput();
    const old = { ...input.evidenceRecords[1], evidenceId:'OLD', measuredValue:2, spatialScope:{scopeType:'POINT_CHOKEPOINT' as const,offsetMeters:10} };
    const malicious = { ...input.evidenceRecords[1], evidenceId:'NEW', supersedesEvidenceId:'OLD', revocationStatus:'REVOKED' as const, sourceAuthorityId:'ATTACKER' };
    const r = assertLocked({ ...input,evidenceRecords:[...input.evidenceRecords,old,malicious] }).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE;
    expect(r.untrustedAssessmentState).toBe('FAILED');
    expect(r.diagnosticReasons).toContain('UNAUTHORIZED_AUTHORITY');
  });
  it.each(['self','cycle'])('%s reference cannot remove any record', kind => {
    const input = createCompleteInput();
    const old = { ...input.evidenceRecords[1], evidenceId:'OLD',measuredValue:2,supersedesEvidenceId:kind==='self'?'OLD':'NEW',spatialScope:{scopeType:'POINT_CHOKEPOINT' as const,offsetMeters:10} };
    const newer = { ...input.evidenceRecords[1], evidenceId:'NEW',supersedesEvidenceId:'OLD' };
    const r = assertLocked({ ...input,evidenceRecords:[...input.evidenceRecords.filter(e=>e.criterion!=='PHYSICAL_HEIGHT_CLEARANCE'),old,newer] }).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE;
    expect(r.untrustedAssessmentState).toBe('FAILED');
    expect(r.evidenceIdsUsed).toEqual(['NEW','OLD']);
    expect(r.diagnosticReasons.some(s=>s.includes(kind==='self'?'SELF_SUPERSESSION':'SUPERSESSION_CYCLE'))).toBe(true);
  });
});

describe('F03: exemptions never replace measurements without verified proof', () => {
  it.each([
    {sourceAuthorityId:'ATTACKER'}, {digitalSignatureStatus:'INVALID_SIGNATURE'}, {graphArtifactSha256:undefined},
    {justificationCode:undefined}, {justificationCode:'NONSENSE'}, {},
  ])('untrusted exemption %j does not hide a load failure', patch => {
    const input = record(createCompleteInput(),3,{measuredValue:1});
    const ex = exemption(input,patch);
    const r = assertLocked({ ...input,notApplicableRecords:[ex] }).criteriaResults.STRUCTURAL_LOAD_CAPACITY;
    expect(r.untrustedAssessmentState).toBe('FAILED');
    expect(r.diagnosticReasons).toContain('EXEMPTION_TRUST_UNAVAILABLE: exemption was not applied');
  });
  it.each([undefined, {bridge:false,tunnel:false}, {bridge:true,tunnel:false}, {bridge:false,tunnel:true}])('metadata %j cannot establish no-bridge exemption', metadata => {
    const input = createCompleteInput();
    const altered = { ...input,edge:{...input.edge,metadata} } as EdgeQualificationInput;
    const r = assertLocked({ ...altered,evidenceRecords:input.evidenceRecords.filter(e=>e.criterion!=='STRUCTURAL_LOAD_CAPACITY'),notApplicableRecords:[exemption(input)] }).criteriaResults.STRUCTURAL_LOAD_CAPACITY;
    expect(['MISSING','INVALID']).toContain(r.state);
    expect(r.state).not.toBe('NOT_APPLICABLE');
  });
  it('terrain highway exemption is schema-valid but unverified; incline/track rejected', () => {
    const input = createCompleteInput();
    const ex = {...exemption(input),criterion:'STATIC_TERRAIN_CAPABILITY',justificationCode:'GRADE_SEPARATED_STANDARD_HIGHWAY'} as NotApplicableEvidenceRecord;
    expect(validateNotApplicableEvidence(ex,{...input.edge.metadata,highwayType:'motorway'}).valid).toBe(true);
    expect(validateNotApplicableEvidence(ex,{...input.edge.metadata,highwayType:'track'}).valid).toBe(false);
    expect(validateNotApplicableEvidence(ex,{...input.edge.metadata,rawTags:{incline:'20%'}}).valid).toBe(false);
    expect(assertLocked({...input,evidenceRecords:input.evidenceRecords.slice(0,7),notApplicableRecords:[ex]}).criteriaResults.STATIC_TERRAIN_CAPABILITY.state).toBe('MISSING');
  });
});

describe('F04: coverage and physical chainage on every criterion', () => {
  it.each([0,-1,NaN,Infinity])('invalid edge length %s is rejected', lengthMeters => {
    expect(assertLocked({...createCompleteInput(),edge:{...createCompleteInput().edge,lengthMeters}}).qualificationErrors).toContain('INVALID_EDGE_LENGTH');
  });
  it.each([40,50,50.1])('length %s never exempts point coverage', lengthMeters => {
    const input=createCompleteInput();
    const records=input.evidenceRecords.map(e=>({...e,spatialScope:{scopeType:'POINT_CHOKEPOINT' as const,offsetMeters:10}}));
    const out=assertLocked({...input,edge:{...input.edge,lengthMeters},evidenceRecords:records});
    for(const r of Object.values(out.criteriaResults)) { expect(r.state).toBe('MISSING'); expect(r.diagnosticReasons).toContain('INSUFFICIENT_SPATIAL_COVERAGE'); }
  });
  it.each([
    {scopeType:'POINT_CHOKEPOINT',offsetMeters:-1}, {scopeType:'POINT_CHOKEPOINT',offsetMeters:9999},
    {scopeType:'POINT_CHOKEPOINT',offsetMeters:Infinity}, {scopeType:'POINT_CHOKEPOINT'},
    {scopeType:'SECTION_SPAN',fromOffsetMeters:0}, {scopeType:'SECTION_SPAN',fromOffsetMeters:100,toOffsetMeters:10},
    {scopeType:'SECTION_SPAN',fromOffsetMeters:0,toOffsetMeters:9999}, {scopeType:'BOGUS'},
  ])('scope %j is invalid', spatialScope => {
    const input=record(createCompleteInput(),1,{spatialScope});
    expect(assertLocked(input).criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INVALID');
  });
  it('discontinuous spans cannot establish complete survey', () => {
    const input=createCompleteInput();const h=input.evidenceRecords[1];
    const spans=[{...h,evidenceId:'S1',spatialScope:{scopeType:'SECTION_SPAN' as const,fromOffsetMeters:0,toOffsetMeters:20}}, {...h,evidenceId:'S2',spatialScope:{scopeType:'SECTION_SPAN' as const,fromOffsetMeters:40,toOffsetMeters:120}}];
    expect(heightResult({...input,evidenceRecords:[...input.evidenceRecords.filter(e=>e.criterion!==h.criterion),...spans]}).state).toBe('MISSING');
  });
  it('full-edge labels are still unauthenticated on all eight criteria', () => {
    const out=assertLocked(createCompleteInput());
    for(const r of Object.values(out.criteriaResults)) { expect(r.state).toBe('INDETERMINATE'); expect(r.diagnosticReasons).toContain('COVERAGE_UNVERIFIED: full-edge declaration has no authoritative verification'); }
  });
});

describe('F09/F10: versioned geometry and independent golden values', () => {
  const golden: {edge: unknown; canonical: string; sha256: string}[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'qualification-geometry-golden.json'), 'utf8'));
  it.each(golden)('V2 independently computed golden $sha256', ({edge, canonical, sha256}) => {
    expect(buildCanonicalGeometryString(edge)).toBe(canonical);
    expect(computeCanonicalEdgeGeometryHash(edge)).toBe(sha256);
  });

  it.each([[.00390625,'0.0039062'],[-.00390625,'-0.0039062'],[.00390635,'0.0039064'],[-.00390635,'-0.0039064'],[5e-8,'0.0000000'],[-5e-8,'0.0000000'],[1.00000005,'1.0000000'],[-1e-11,'0.0000000'],[-0,'0.0000000']] as const)('Half-Even decimal number %s = %s', (n, expected) => expect(formatCoordinate(n)).toBe(expected));
  it.each([NaN,Infinity,-Infinity,90.0001])('invalid latitude %s is rejected', n=>expect(()=>formatCoordinate(n)).toThrow());
  it.each([180.0001,-180.0001])('invalid longitude %s is rejected', n=>expect(()=>formatCoordinate(n,'lon')).toThrow());
  it('WGS84 extremes and scientific decimal notation are deterministic',()=>{
    expect(formatCoordinate(-90)).toBe('-90.0000000');expect(formatCoordinate(180,'lon')).toBe('180.0000000');expect(formatCoordinate(1e-7)).toBe('0.0000001');
  });
  it.each([{fromNodeId:'A->B',toNodeId:'C'},{fromNodeId:'A',toNodeId:'B->C'},{fromNodeId:'A|GEO:x',toNodeId:'C'},{fromNodeId:'A',toNodeId:'B;C'}])('rejects delimiter IDs %j', ids=>expect(()=>buildCanonicalGeometryString({...createCompleteInput().edge,...ids})).toThrow('INVALID_EDGE_IDENTITY'));
  it.each([undefined,0,1,'false',null])('direction %s must be an actual boolean', isWayForward=>expect(()=>buildCanonicalGeometryString({...createCompleteInput().edge,isWayForward})).toThrow('INVALID_EDGE_DIRECTION'));
  it('current importer OSM node grammar is accepted and length prefixed',()=>{
    const edge={...createCompleteInput().edge,fromNodeId:'node_osm_123',toNodeId:'node_osm_456'};
    expect(buildCanonicalGeometryString(edge)).toContain('EDGE:12:node_osm_123->12:node_osm_456|FWD:true');
  });
  it.each([{geometry:[{lat:0,lon:0},{lat:1e-9,lon:1e-9}]},{geometry:[{lat:16,lon:108},{lat:16,lon:108}]}])('rejects zero length after quantization $geometry',({geometry})=>expect(()=>computeCanonicalEdgeGeometryHash({...createCompleteInput().edge,geometry})).toThrow('DEGENERATE_GEOMETRY_ERROR'));
  it('retains legacy vectors without confusing V1 and V2 hashes',()=>{
    const edge=createCompleteInput().edge;
    const legacy=crypto.createHash('sha256').update(buildLegacyCanonicalGeometryString(edge),'utf8').digest('hex');
    expect(legacy).toBe('ec4e64d4bb52b82cea9f823977467113476764cb436e1d334eba79bd7264ad6b');
    expect(computeCanonicalEdgeGeometryHash(edge)).not.toBe(legacy);
    expect(buildCanonicalGeometryString(edge)).toBe(`${GEOMETRY_HASH_VERSION}|EDGE:2:N1->2:N2|FWD:true|GEO:16.0650000,108.2150000;16.0660000,108.2160000`);
  });
});

describe('F11/F12: resolution behavior, diagnostics, determinism and immutability',()=>{
  function resolve(records: CriterionEvidenceRecord[]) {
    const input=createCompleteInput();
    return resolveCriterionEvidence({criterion:records[0]?.criterion??'PHYSICAL_HEIGHT_CLEARANCE',evidenceList:records,vehicleProfile:input.vehicleProfile,evaluatedAt:input.evaluatedAt,edge:input.edge});
  }
  it('same-location numeric conflict is detected before certain failure',()=>{
    const h=createCompleteInput().evidenceRecords[1];const result=resolve([{...h,evidenceId:'A',measuredValue:2},{...h,evidenceId:'B',measuredValue:4.5}]);
    expect(result.state).toBe('CONFLICTING');expect(result.diagnosticReasons).toContain('CONFLICTING: FULL_EDGE');
  });
  it('independent failure dominates conflict but preserves both reasons',()=>{
    const h=createCompleteInput().evidenceRecords[1];
    const result=resolve([{...h,evidenceId:'A',measuredValue:2},{...h,evidenceId:'B',measuredValue:4.5},{...h,evidenceId:'C',measuredValue:2,spatialScope:{scopeType:'POINT_CHOKEPOINT',offsetMeters:10}}]);
    expect(result.untrustedAssessmentState).toBe('FAILED');expect(result.diagnosticReasons).toEqual(expect.arrayContaining(['CONFLICTING: FULL_EDGE','FAIL_CERTAIN: POINT:10']));
  });
  it('indeterminate plus conflict preserves both diagnostics',()=>{
    const h=createCompleteInput().evidenceRecords[1];const result=resolve([{...h,evidenceId:'A',measuredValue:2},{...h,evidenceId:'B',measuredValue:4.5},{...h,evidenceId:'C',measuredValue:3.1,spatialScope:{scopeType:'POINT_CHOKEPOINT',offsetMeters:10}}]);
    expect(result.state).toBe('CONFLICTING');expect(result.diagnosticReasons).toContain('INDETERMINATE: POINT:10');
  });
  it('boolean contradiction does not use fabricated numeric interval conflict',()=>{
    const h=createCompleteInput().evidenceRecords[0];const result=resolve([{...h,evidenceId:'A',booleanValue:true},{...h,evidenceId:'B',booleanValue:false}]);expect(result.state).toBe('CONFLICTING');
  });
  it('expired+invalid+revoked reasons survive with a valid measurement',()=>{
    const h=createCompleteInput().evidenceRecords[1];const result=resolve([h,{...h,evidenceId:'EX',validUntil:'2026-05-15T00:00:00Z'},{...h,evidenceId:'BAD',measurementUncertainty:0},{...h,evidenceId:'REV',revocationStatus:'REVOKED'}]);
    expect(result.diagnosticReasons).toEqual(expect.arrayContaining(['EVIDENCE_EXPIRED: EX','INVALID_UNCERTAINTY','EVIDENCE_REVOKED: REV']));
  });
  it('malformed profile does not hide an independent evidence schema failure',()=>{
    const input=record(createCompleteInput(),1,{measurementUncertainty:0});
    const output=assertLocked({...input,vehicleProfile:{...input.vehicleProfile,status:'REVOKED'}});
    expect(output.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons).toEqual(expect.arrayContaining(['UNAPPROVED_PROFILE_STATUS','INVALID_UNCERTAINTY']));
  });
  it('earliest expiration uses all active evidence and ignores expired records',()=>{
    const input=record(createCompleteInput(),1,{validUntil:'2026-07-01T00:00:00Z'});
    expect(assertLocked(input).earliestExpirationTimestamp).toBe('2026-07-01T00:00:00Z');
  });
  it('duplicate IDs are rejected instead of silently deduplicating records',()=>{
    const input=createCompleteInput();expect(assertLocked({...input,evidenceRecords:[...input.evidenceRecords,input.evidenceRecords[1]]}).qualificationErrors).toContain('DUPLICATE_EVIDENCE_ID: BASE-1');
  });
  it('permutation produces identical JSON; inputs are deeply frozen and unchanged',()=>{
    const input=createCompleteInput();
    const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.freeze(v);for(const child of Object.values(v))freeze(child);}};
    const before=JSON.stringify(input);freeze(input);
    const output=assertLocked(input),permuted=assertLocked({...input,evidenceRecords:[...input.evidenceRecords].reverse()});
    expect(JSON.stringify(output)).toBe(JSON.stringify(permuted));expect(JSON.stringify(input)).toBe(before);
  });
  it.each([null,undefined,[],{}, {edge:null,vehicleProfile:null,evidenceRecords:[null]}])('malformed runtime input %j fails closed without throwing', input=>{ assertLocked(input as unknown as EdgeQualificationInput); });
});

// Acceptance specs 5B.1 17–20 require actual Android/sidecar/UCS integration.
// DEFERRED_TO_INTEGRATION: legacy routing, sidecar checksum, offline 72h revocation,
// bounded-corridor UCS. They are deliberately not fake passing unit tests.
