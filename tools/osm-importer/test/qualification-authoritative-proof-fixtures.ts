import {
  LegalBasisProof,
  StructureInventoryProof,
  SurveyProof,
  PROOF_SCHEMA,
} from '../src/qualification-proof-types';
import { baseGraph } from './qualification-verification-test-fixtures';
import { pipelineFixture } from './qualification-verification-pipeline-fixtures';
export function proofFixtures() {
  const graph = pipelineFixture();
  const base = {
    schema: PROOF_SCHEMA,
    proofId: 'PROOF_BASE',
    document: {
      documentId: 'DOC',
      authorityId: 'PROOF_AUTHORITY',
      category: 'LEGAL_PROOF' as const,
      sha256: 'a'.repeat(64),
      signatureReference: 'SIGNATURE_REF',
      registryId: 'PROOF_REGISTRY',
      snapshotId: 'SNAPSHOT_1',
      keyId: 'KEY_1',
    },
    binding: graph.binding,
    criterion: 'STRUCTURAL_LOAD_CAPACITY' as const,
    edgeLengthMeters: 120,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    revocation: { status: 'ACTIVE' as const, reference: 'REVOCATION_REF' },
    references: [
      {
        documentId: 'INSPECTION_DOC',
        sha256: 'b'.repeat(64),
        authorityId: 'PROOF_AUTHORITY',
        role: 'INSPECTION' as const,
      },
      {
        documentId: 'CALIBRATION_DOC',
        sha256: 'c'.repeat(64),
        authorityId: 'PROOF_AUTHORITY',
        role: 'CALIBRATION' as const,
      },
    ],
    conflictStatus: 'NONE_DECLARED' as const,
  };
  const legal: LegalBasisProof = {
    ...base,
    kind: 'LEGAL',
    proofId: 'LEGAL_1',
    document: { ...base.document, documentId: 'LEGAL_DOC' },
    legalBasisReference: 'TEST_ONLY_LEGAL_REFERENCE',
    jurisdiction: {
      jurisdictionId: 'TEST_JURISDICTION',
      geometryReference: 'TEST_JURISDICTION_GEOMETRY',
      edgeIds: [graph.binding.edgeId],
    },
    structureId: 'STRUCTURE_A',
    applicabilityProviderReference: null,
  };
  const inventory: StructureInventoryProof = {
    ...base,
    kind: 'STRUCTURE_INVENTORY',
    proofId: 'INVENTORY_1',
    document: {
      ...base.document,
      category: 'STRUCTURE_PROOF',
      documentId: 'INVENTORY_DOC',
    },
    inventoryId: 'TEST_INVENTORY',
    inventoryVersion: '1',
    inventoryCoverage: [{ kind: 'SPAN', from: 0, to: 120 }],
    completeness: 'DECLARED_ONLY',
    hiddenStructures: 'UNKNOWN',
    osmBridgeTag: 'NO',
    structures: [
      {
        structureId: 'STRUCTURE_A',
        type: 'CULVERT',
        geometryReference: graph.binding.canonicalGeometryHash,
        extent: { kind: 'SPAN', from: 0, to: 120 },
        surveyDocumentId: 'SURVEY_DOC',
        inspectionDocumentId: 'INSPECTION_DOC',
        limitations: [
          {
            criterion: 'STRUCTURAL_LOAD_CAPACITY',
            value: 20,
            unit: 't',
            uncertainty: 0.1,
          },
        ],
      },
    ],
  };
  const survey: SurveyProof = {
    ...base,
    kind: 'SURVEY',
    proofId: 'SURVEY_1',
    document: {
      ...base.document,
      category: 'SURVEY_PROOF',
      documentId: 'SURVEY_DOC',
    },
    surveyId: 'TEST_SURVEY',
    measurements: [
      {
        measurementId: 'M1',
        structureId: 'STRUCTURE_A',
        criterion: 'STRUCTURAL_LOAD_CAPACITY',
        value: 20,
        unit: 't',
        uncertainty: 0.1,
        method: 'TEST_LOAD_MEASUREMENT',
        instrumentReference: 'INSTRUMENT',
        calibrationReference: 'CALIBRATION_DOC',
        surveyorId: 'TEST_SURVEYOR',
        surveyAuthorityId: 'PROOF_AUTHORITY',
        collectedAt: '2026-05-01T00:00:00Z',
        location: { ...baseGraph().edges[0].geometry[0] },
        extent: { kind: 'SPAN', from: 0, to: 120 },
        provenanceReference: 'TEST_SURVEY_PROVENANCE',
        sourceDocumentId: 'SURVEY_DOC',
        disposition: 'ACTIVE',
        finding: 'RECORDED',
        supersedesMeasurementId: null,
      },
    ],
    coverageDeclaration: 'WHOLE_EDGE',
    reinspection: {
      policyReference: 'TEST_REINSPECTION',
      dueAt: '2027-01-01T00:00:00Z',
      maximumAgeSeconds: 31536000,
    },
    supersedesProofId: null,
  };
  return { graph, legal, inventory, survey };
}
