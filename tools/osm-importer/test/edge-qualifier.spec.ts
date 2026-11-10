import * as crypto from 'crypto';
import { createMockRescueTruckProfile, createMockEdge, createMockEvidence, createMockNotApplicableEvidence, createCompleteInput } from './qualification-fixtures';
/**
 * Phase 5 - Task 5C.1: Safety Qualification Engine Test Foundation
 * 27 retained historical scenarios, corrected for the locked diagnostic API.
 * Android/sidecar/UCS acceptance remains DEFERRED_TO_INTEGRATION.
 */

import { EdgeQualifier } from '../src/edge-qualifier';
import {
  CriterionEvidenceRecord,
  NotApplicableEvidenceRecord,
  QualificationCriterion,
  RescueVehicleProfile,
} from '../src/qualification-types';
import {
  buildCanonicalGeometryString,
  buildLegacyCanonicalGeometryString,
  computeCanonicalEdgeGeometryHash,
  formatCoordinate,
} from '../src/qualification-geometry';
import { RoadEdge } from '../src/types';

// ============================================================================
// FIXTURE FACTORIES
// ============================================================================

// ============================================================================
// TEST SUITE
// ============================================================================

describe('Phase 5 - Task 5C.1: Safety Qualification Engine & Test Foundation', () => {
  const qualifier = new EdgeQualifier();
  const defaultProfile = createMockRescueTruckProfile();
  const defaultEvaluatedAt = '2026-06-01T00:00:00Z';
  const graphVersion = 'dn_central_real_v1';
  const graphArtifactSha256 =
    '1b7f64a965a763624e0a6c2cd866352fc3ef5f106214907866d0c6dcb49c25b4';

  // --------------------------------------------------------------------------
  // CANONICAL GEOMETRY & FIXED TEST VECTORS
  // --------------------------------------------------------------------------
  describe('Canonical Edge Geometry Hash & Rounding Determinism', () => {
    it('TEST-14: Forward Edge Canonical Hash Vector 1 Reproducibility', () => {
      const edge = createMockEdge({
        fromNodeId: 'N1',
        toNodeId: 'N2',
        isWayForward: true,
        geometry: [
          { lat: 16.065, lon: 108.215 },
          { lat: 16.066, lon: 108.216 },
        ],
      });

      const canonicalStr = buildLegacyCanonicalGeometryString(edge);
      expect(canonicalStr).toBe(
        'EDGE:N1->N2|FWD:true|GEO:16.0650000,108.2150000;16.0660000,108.2160000',
      );

      const hash = crypto.createHash('sha256').update(buildLegacyCanonicalGeometryString(edge), 'utf8').digest('hex');
      expect(hash).toBe(
        'ec4e64d4bb52b82cea9f823977467113476764cb436e1d334eba79bd7264ad6b',
      );
    });

    it('TEST-15: Reverse Edge Canonical Hash Vector 2 Reproducibility (No Double Reversal)', () => {
      // For reverse edge, coordinates were ALREADY reversed at ingestion time
      const edge = createMockEdge({
        id: 'EDGE_N2_N1_REV',
        fromNodeId: 'N2',
        toNodeId: 'N1',
        isWayForward: false,
        geometry: [
          { lat: 16.066, lon: 108.216 },
          { lat: 16.065, lon: 108.215 },
        ],
      });

      const canonicalStr = buildLegacyCanonicalGeometryString(edge);
      expect(canonicalStr).toBe(
        'EDGE:N2->N1|FWD:false|GEO:16.0660000,108.2160000;16.0650000,108.2150000',
      );

      const hash = crypto.createHash('sha256').update(buildLegacyCanonicalGeometryString(edge), 'utf8').digest('hex');
      expect(hash).toBe(
        '4fbd28765fcf2475ff508fb3c68d2cf3d60bda1907dde43fd5eec28d26253a06',
      );
    });

    it('TEST-16: Negative Zero Normalization Parity', () => {
      expect(formatCoordinate(-0.0, 'lat')).toBe('0.0000000');
      expect(formatCoordinate(0.0, 'lat')).toBe('0.0000000');
      expect(formatCoordinate(-0.00000000001, 'lat')).toBe('0.0000000');
    });

    it('TEST-17: Rounding boundary and Degenerate Geometry Rejection', () => {
      // Degenerate geometry (fewer than 2 points)
      expect(() =>
        computeCanonicalEdgeGeometryHash({
          fromNodeId: 'N1',
          toNodeId: 'N2',
          isWayForward: true,
          geometry: [{ lat: 16.0, lon: 108.0 }],
        }),
      ).toThrow('DEGENERATE_GEOMETRY_ERROR');

      // Degenerate geometry (identical points)
      expect(() =>
        computeCanonicalEdgeGeometryHash({
          fromNodeId: 'N1',
          toNodeId: 'N2',
          isWayForward: true,
          geometry: [
            { lat: 16.0, lon: 108.0 },
            { lat: 16.0, lon: 108.0 },
          ],
        }),
      ).toThrow('DEGENERATE_GEOMETRY_ERROR');

      // Boundary values
      expect(formatCoordinate(90.0, 'lat')).toBe('90.0000000');
      expect(formatCoordinate(-90.0, 'lat')).toBe('-90.0000000');
      expect(() => formatCoordinate(90.0001, 'lat')).toThrow('WGS84_LATITUDE_OUT_OF_BOUNDS');
      expect(() => formatCoordinate(NaN, 'lat')).toThrow('INVALID_COORDINATE_VALUE');
    });
  });

  // --------------------------------------------------------------------------
  // TIER 1 & TIER 2 EVALUATION & BOTTLENECK PRECEDENCE
  // --------------------------------------------------------------------------
  describe('Uncertainty Evaluation & Conflict Precedence', () => {
    it('TEST-01: Certain Height Failure remains an unauthenticated failure diagnostic', () => {
      // Vehicle needs 3.0m + 0.1m = 3.10m
      // Survey: 2.70m +/- 0.02m (upper = 2.72m < 3.10m) -> FAIL_CERTAIN technical diagnostic; provenance remains unverified
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const evidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 2.7,
        measurementUncertainty: 0.02,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.untrustedAssessmentState).toBe('FAILED');
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.measurementDecision).toBe('FAIL_CERTAIN');
    });

    it('TEST-02: Indeterminate Measurement Remains UNVERIFIED', () => {
      // Vehicle needs 3.10m
      // Survey: 3.12m +/- 0.05m (lower = 3.07m < 3.10m <= 3.17m = upper) -> INDETERMINATE -> UNVERIFIED
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const evidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 3.12,
        measurementUncertainty: 0.05,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INDETERMINATE');
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.measurementDecision).toBe('INDETERMINATE');
    });

    it('TEST-03: Certain Height Pass Satisfies Criterion', () => {
      // Vehicle needs 3.10m
      // Survey: 3.80m +/- 0.05m (lower = 3.75m >= 3.10m) -> PASS_CERTAIN, unauthenticated technical pass only
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const evidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 3.8,
        measurementUncertainty: 0.05,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.untrustedAssessmentState).toBe('SATISFIED');
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.measurementDecision).toBe('PASS_CERTAIN');
      // Still overall UNVERIFIED because other 7 criteria are MISSING
      expect(record.qualificationStatus).toBe('UNVERIFIED');
    });

    it('TEST-04: Different-Location Physical Bottleneck Precedence', () => {
      // At km 0+050 (offset 50m): 2.10m +/- 0.02m (FAIL_CERTAIN)
      // At km 0+200 (offset 200m): 3.50m +/- 0.02m (PASS_CERTAIN)
      // Vehicle needs 2.40m width
      // Obstruction at km 0+050 dominates the untrusted technical assessment
      const edge = createMockEdge({ lengthMeters: 300.0 });
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const chokepointEvidence = createMockEvidence({
        evidenceId: 'EVID-CHOKE-50M',
        criterion: 'PHYSICAL_WIDTH_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 2.1,
        measurementUncertainty: 0.02,
        spatialScope: {
          scopeType: 'POINT_CHOKEPOINT',
          offsetMeters: 50.0,
          locationDescription: 'Ban công nhô ra tại km 0+050',
        },
      });

      const wideEvidence = createMockEvidence({
        evidenceId: 'EVID-WIDE-200M',
        criterion: 'PHYSICAL_WIDTH_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 3.5,
        measurementUncertainty: 0.02,
        spatialScope: {
          scopeType: 'POINT_CHOKEPOINT',
          offsetMeters: 200.0,
          locationDescription: 'Lòng đường thoáng tại km 0+200',
        },
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [chokepointEvidence, wideEvidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.criteriaResults.PHYSICAL_WIDTH_CLEARANCE.untrustedAssessmentState).toBe('FAILED');
      expect(record.criteriaResults.PHYSICAL_WIDTH_CLEARANCE.measurementDecision).toBe('FAIL_CERTAIN');
    });

    it('TEST-05: Same-Location Conflicting Measurements Fail Closed to CONFLICTING', () => {
      // Both at offset 50m:
      // Authority A: 2.10m +/- 0.02m -> [2.08, 2.12]
      // Authority B: 3.50m +/- 0.02m -> [3.48, 3.52]
      // Disjoint intervals -> CONFLICTING -> UNVERIFIED
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const evA = createMockEvidence({
        evidenceId: 'EVID-A',
        criterion: 'PHYSICAL_WIDTH_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 2.1,
        measurementUncertainty: 0.02,
        spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 50.0 },
      });

      const evB = createMockEvidence({
        evidenceId: 'EVID-B',
        criterion: 'PHYSICAL_WIDTH_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 3.5,
        measurementUncertainty: 0.02,
        spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 50.0 },
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evA, evB],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.criteriaResults.PHYSICAL_WIDTH_CLEARANCE.state).toBe('CONFLICTING');
    });

    it('TEST-06: Compatible Uncertainty Intervals Yield Conservative Pass', () => {
      // Both at offset 50m:
      // A: 3.20m +/- 0.05m -> [3.15, 3.25]
      // B: 3.22m +/- 0.04m -> [3.18, 3.26]
      // Overlapping! Vehicle needs 3.10m height. Declared full coverage; production coverage remains unverified
      const edge = createMockEdge({ lengthMeters: 40.0 });
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const evA = createMockEvidence({
        evidenceId: 'EVID-A',
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 3.2,
        measurementUncertainty: 0.05,
        spatialScope: { scopeType: 'CONTINUOUS_FULL_EDGE' },
      });

      const evB = createMockEvidence({
        evidenceId: 'EVID-B',
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 3.22,
        measurementUncertainty: 0.04,
        spatialScope: { scopeType: 'CONTINUOUS_FULL_EDGE' },
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evA, evB],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.untrustedAssessmentState).toBe('SATISFIED');
      // Conservative bound: min(3.15, 3.18) = 3.15m
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.effectiveValue).toBeCloseTo(3.15, 2);
    });
  });

  // --------------------------------------------------------------------------
  // INTEGRITY, FRESHNESS, AND EXEMPTION CONTRACTS
  // --------------------------------------------------------------------------
  describe('Integrity, Freshness & Statutory Exemption Rules', () => {
    it('TEST-07: Invalid Evidence Formatting (zero uncertainty) Fails Closed', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const invalidEvidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 4.5,
        measurementUncertainty: 0.0, // INVALID: must be > 0.0
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [invalidEvidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INVALID');
      expect(record.qualificationStatus).toBe('UNVERIFIED');
    });

    it('TEST-08: Expired Evidence Fails Closed to EXPIRED', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const expiredEvidence = createMockEvidence({
        criterion: 'STRUCTURAL_LOAD_CAPACITY',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 30.0,
        validUntil: '2026-05-15T00:00:00Z', // Expired relative to 2026-06-01
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [expiredEvidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.STRUCTURAL_LOAD_CAPACITY.state).toBe('EXPIRED');
      expect(record.qualificationStatus).toBe('UNVERIFIED');
    });

    it('TEST-09: Missing Mandatory Criterion Keeps Edge UNVERIFIED', () => {
      const edge = createMockEdge();
      // Exactly seven diagnostic criteria; surface is missing.
      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: createCompleteInput().evidenceRecords.filter(e => e.criterion !== 'SURFACE_SUITABILITY'),
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.SURFACE_SUITABILITY.state).toBe('MISSING');
      expect(record.qualificationStatus).toBe('UNVERIFIED');
    });

    it('TEST-10: Schema-valid exemption remains unapplied without authenticity', () => {
      const edge = createMockEdge({
        metadata: { ...createMockEdge().metadata, bridge: false, tunnel: false },
      });
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const exemption = createMockNotApplicableEvidence({
        criterion: 'STRUCTURAL_LOAD_CAPACITY',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        justificationCode: 'AT_GRADE_SOLID_EARTH_NO_CROSSING_STRUCTURE',
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [],
        notApplicableRecords: [exemption],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.STRUCTURAL_LOAD_CAPACITY.state).toBe('MISSING');
    });

    it('TEST-11: Illegal Exemption of Mandatory Criterion (LEGAL_ACCESS) is Rejected', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const illegalExemption = createMockNotApplicableEvidence({
        criterion: 'LEGAL_ACCESS', // Strictly non-exemptible
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [],
        notApplicableRecords: [illegalExemption],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.LEGAL_ACCESS.state).toBe('INVALID');
    });

    it('TEST-12: Bridge Structural Load Exemption is Rejected as INVALID', () => {
      const edge = createMockEdge({
        metadata: { ...createMockEdge().metadata, bridge: true },
      });
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const illegalBridgeExemption = createMockNotApplicableEvidence({
        criterion: 'STRUCTURAL_LOAD_CAPACITY',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [],
        notApplicableRecords: [illegalBridgeExemption],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.STRUCTURAL_LOAD_CAPACITY.state).toBe('INVALID');
    });

    it('TEST-13: Terrain Exemption Rejected on Steep Track', () => {
      const edge = createMockEdge({
        metadata: { ...createMockEdge().metadata, highwayType: 'track' },
      });
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const illegalTrackExemption = createMockNotApplicableEvidence({
        criterion: 'STATIC_TERRAIN_CAPABILITY',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [],
        notApplicableRecords: [illegalTrackExemption],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.STATIC_TERRAIN_CAPABILITY.state).toBe('INVALID');
    });
  });

  // --------------------------------------------------------------------------
  // IDENTITY, BINDING, PKI, AND PACKAGING BOUNDARY
  // --------------------------------------------------------------------------
  describe('Identity Binding, PKI and Boundary Defense', () => {
    it('TEST-18: Evidence Geometry Hash Mismatch Fails Closed', () => {
      const edge = createMockEdge();
      // Evidence has mismatching geometry hash
      const evidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: '0000000000000000000000000000000000000000000000000000000000000000',
        measuredValue: 4.5,
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INVALID');
      expect(record.qualificationWarnings).toEqual(
        expect.arrayContaining([expect.stringContaining('EVIDENCE_GEOMETRY_MISMATCH')]),
      );
    });

    it('TEST-19: Revoked Profile is Rejected with Error', () => {
      const edge = createMockEdge();
      const revokedProfile = createMockRescueTruckProfile({
        status: 'REVOKED',
        approvalProvenance: {
          ...defaultProfile.approvalProvenance,
          revocationStatus: 'REVOKED_SAFETY_NOTICE',
        },
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: revokedProfile,
        evidenceRecords: [],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.qualificationErrors).toEqual(
        expect.arrayContaining([expect.stringContaining('REVOKED_PROFILE')]),
      );
    });

    it('TEST-20: Synthetic Evidence Rejected in Strict Production Mode', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const mockEvidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        sourceAuthorityId: 'TEST_MOCK_SURVEY_AUTHORITY', // Synthetic prefix
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [mockEvidence],
        evaluatedAt: defaultEvaluatedAt,
        requireProductionApproved: true,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('INVALID');
      expect(record.qualificationStatus).toBe('UNVERIFIED');
    });

    it('TEST-21: Provisional Profile Without PKI is Rejected in Strict Production Mode', () => {
      const edge = createMockEdge();
      const provisionalProfile = createMockRescueTruckProfile({
        status: 'PROVISIONAL_DEVELOPMENT',
        approvalProvenance: {
          ...defaultProfile.approvalProvenance,
          verificationMethod: 'UNVERIFIED_DEVELOPMENT_PROTOTYPE',
          digitalSignatureStatus: 'UNVERIFIED_NOT_CONFIGURED',
        },
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: provisionalProfile,
        evidenceRecords: [],
        evaluatedAt: defaultEvaluatedAt,
        requireProductionApproved: true,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.isProductionApproved).toBe(false);
      expect(record.qualificationErrors.some((e) => e.includes('PROTOTYPE_PROFILE_IN_PRODUCTION') || e.includes('PRODUCTION_APPROVAL_REJECTED'))).toBe(true);
    });

    it('TEST-22: Incomplete Spatial Coverage on Long Edge Fails to MISSING', () => {
      // Edge is 200m long. Point measurement at offset 10m does not cover full edge
      const edge = createMockEdge({ lengthMeters: 200.0 });
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const singlePointEvidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 4.5,
        spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 10.0 },
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [singlePointEvidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('MISSING');
      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.diagnosticReasons[0]).toContain(
        'INSUFFICIENT_SPATIAL_COVERAGE',
      );
    });

    it('TEST-23: Revoked Evidence Downgrades Criterion to MISSING', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const revokedEvidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 4.5,
        revocationStatus: 'REVOKED',
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [revokedEvidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.state).toBe('MISSING');
    });

    it('TEST-24: Unauthenticated supersession retains the old bottleneck', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const oldFailingEvidence = createMockEvidence({
        evidenceId: 'EVID-OLD-DEFECT',
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 2.5, // Failing
        spatialScope: { scopeType: 'POINT_CHOKEPOINT', offsetMeters: 10 },
      });

      const newFixedEvidence = createMockEvidence({
        evidenceId: 'EVID-NEW-FIXED',
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 4.5, // Satisfying
        supersedesEvidenceId: 'EVID-OLD-DEFECT',
      });

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [oldFailingEvidence, newFixedEvidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.criteriaResults.PHYSICAL_HEIGHT_CLEARANCE.untrustedAssessmentState).toBe('FAILED');
    });

    it('TEST-25: Diagnostic evaluation does not mutate edge routing fields', () => {
      // Qualifying a single edge must not alter graph-level readiness or base graph invariant
      const edge = createMockEdge();
      expect(edge.compatibilityStatus).toBe('UNVERIFIED');
      expect(edge.isEligibleForStrictRouting).toBe(false);

      const geomHash = computeCanonicalEdgeGeometryHash(edge);
      const allEvidences: CriterionEvidenceRecord[] = [
        createMockEvidence({ criterion: 'LEGAL_ACCESS', edgeId: edge.id, canonicalGeometryHash: geomHash, booleanValue: true }),
        createMockEvidence({ criterion: 'PHYSICAL_HEIGHT_CLEARANCE', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 4.5 }),
        createMockEvidence({ criterion: 'PHYSICAL_WIDTH_CLEARANCE', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 4.0 }),
        createMockEvidence({ criterion: 'STRUCTURAL_LOAD_CAPACITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 20.0 }),
        createMockEvidence({ criterion: 'AXLE_LOAD_CAPACITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 10.0 }),
        createMockEvidence({ criterion: 'SURFACE_SUITABILITY', edgeId: edge.id, canonicalGeometryHash: geomHash, booleanValue: true }),
        createMockEvidence({ criterion: 'GEOMETRIC_FEASIBILITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 5.0 }),
        createMockEvidence({ criterion: 'STATIC_TERRAIN_CAPABILITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 0.1 }),
      ];

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: allEvidences,
        evaluatedAt: defaultEvaluatedAt,
      });

      // No fixture can produce production qualification
      expect(record.qualificationStatus).toBe('UNVERIFIED');

      // The edge object remains untouched (pure module)
      expect(edge.compatibilityStatus).toBe('UNVERIFIED');
      expect(edge.isEligibleForStrictRouting).toBe(false);
    });

    it('TEST-26: All 8 declared criteria never establish production trust', () => {
      const edge = createMockEdge();
      const geomHash = computeCanonicalEdgeGeometryHash(edge);

      const allEvidences: CriterionEvidenceRecord[] = [
        createMockEvidence({ criterion: 'LEGAL_ACCESS', edgeId: edge.id, canonicalGeometryHash: geomHash, booleanValue: true }),
        createMockEvidence({ criterion: 'PHYSICAL_HEIGHT_CLEARANCE', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 4.5 }),
        createMockEvidence({ criterion: 'PHYSICAL_WIDTH_CLEARANCE', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 4.0 }),
        createMockEvidence({ criterion: 'STRUCTURAL_LOAD_CAPACITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 20.0 }),
        createMockEvidence({ criterion: 'AXLE_LOAD_CAPACITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 10.0 }),
        createMockEvidence({ criterion: 'SURFACE_SUITABILITY', edgeId: edge.id, canonicalGeometryHash: geomHash, booleanValue: true }),
        createMockEvidence({ criterion: 'GEOMETRIC_FEASIBILITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 5.0 }),
        createMockEvidence({ criterion: 'STATIC_TERRAIN_CAPABILITY', edgeId: edge.id, canonicalGeometryHash: geomHash, measuredValue: 0.1 }),
      ];

      const record = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: allEvidences,
        evaluatedAt: defaultEvaluatedAt,
      });

      expect(record.qualificationStatus).toBe('UNVERIFIED');
      expect(record.isProductionApproved).toBe(false);
      expect(record.earliestExpirationTimestamp).toBe('2027-01-01T00:00:00Z');
    });

    it('TEST-27: Diagnostic record preserves edge and geometry identity', () => {
      // This unit test asserts only diagnostic identity, not an Android contract gate.
      const edge = createMockEdge();
      expect(edge.compatibilityStatus).toBe('UNVERIFIED');

      // Sidecar record exists separately from the BaseRoadGraph
      const geomHash = computeCanonicalEdgeGeometryHash(edge);
      const evidence = createMockEvidence({
        criterion: 'PHYSICAL_HEIGHT_CLEARANCE',
        edgeId: edge.id,
        canonicalGeometryHash: geomHash,
        measuredValue: 4.5,
      });

      const sidecarRecord = qualifier.qualifyEdge({
        edge,
        graphVersion,
        graphArtifactSha256,
        vehicleProfile: defaultProfile,
        evidenceRecords: [evidence],
        evaluatedAt: defaultEvaluatedAt,
      });

      // Sidecar has its own identity bound to edgeId and geomHash
      expect(sidecarRecord.edgeId).toBe(edge.id);
      expect(sidecarRecord.canonicalGeometryHash).toBe(geomHash);
    });
  });
});
