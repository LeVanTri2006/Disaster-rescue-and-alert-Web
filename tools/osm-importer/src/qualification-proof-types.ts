import { EdgeIdentityBinding } from './qualification-identity-binding';
import { QualificationCriterion } from './qualification-types';
export const PROOF_SCHEMA = 'qualification-authoritative-proof-v1' as const;
export type ProofCategory = 'LEGAL_PROOF' | 'STRUCTURE_PROOF' | 'SURVEY_PROOF';
export type StructureKind =
  | 'BRIDGE'
  | 'TUNNEL'
  | 'CULVERT'
  | 'CROSSING'
  | 'ROAD_STRUCTURE'
  | 'OTHER_LOAD_BEARING';
export type SurveyExtent = Readonly<
  { kind: 'POINT'; offset: number } | { kind: 'SPAN'; from: number; to: number }
>;
export interface AuthoritativeReference {
  readonly documentId: string;
  readonly sha256: string;
  readonly authorityId: string;
  readonly role:
    'LEGAL' | 'INVENTORY' | 'INSPECTION' | 'SURVEY' | 'CALIBRATION';
}
export interface ProofDocumentReference {
  readonly documentId: string;
  readonly authorityId: string;
  readonly category: ProofCategory;
  readonly sha256: string;
  readonly signatureReference: string;
  readonly registryId: string;
  readonly snapshotId: string;
  readonly keyId: string;
}
export interface ProofBase {
  readonly schema: typeof PROOF_SCHEMA;
  readonly proofId: string;
  readonly document: ProofDocumentReference;
  readonly binding: EdgeIdentityBinding;
  readonly criterion: QualificationCriterion;
  readonly edgeLengthMeters: number;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly revocation: {
    readonly status: 'ACTIVE' | 'REVOKED' | 'UNKNOWN';
    readonly reference: string;
  };
  readonly references: readonly AuthoritativeReference[];
  readonly conflictStatus: 'NONE_DECLARED' | 'UNRESOLVED';
}
export interface LegalBasisProof extends ProofBase {
  readonly kind: 'LEGAL';
  readonly legalBasisReference: string;
  readonly jurisdiction: {
    readonly jurisdictionId: string;
    readonly geometryReference: string;
    readonly edgeIds: readonly string[];
  };
  readonly structureId: string;
  readonly applicabilityProviderReference: string | null;
}
export interface StructureRecord {
  readonly structureId: string;
  readonly type: StructureKind;
  readonly geometryReference: string;
  readonly extent: SurveyExtent;
  readonly surveyDocumentId: string;
  readonly inspectionDocumentId: string;
  readonly limitations: readonly {
    readonly criterion: QualificationCriterion;
    readonly value: number;
    readonly unit: string;
    readonly uncertainty: number;
  }[];
}
export interface StructureInventoryProof extends ProofBase {
  readonly kind: 'STRUCTURE_INVENTORY';
  readonly inventoryId: string;
  readonly inventoryVersion: string;
  readonly inventoryCoverage: readonly SurveyExtent[];
  readonly completeness: 'DECLARED_ONLY';
  readonly hiddenStructures: 'UNKNOWN' | 'DECLARED_COMPLETE';
  readonly osmBridgeTag: 'YES' | 'NO' | 'UNKNOWN';
  readonly structures: readonly StructureRecord[];
}
export interface SurveyMeasurement {
  readonly measurementId: string;
  readonly structureId: string;
  readonly criterion: QualificationCriterion;
  readonly value: number;
  readonly unit: string;
  readonly uncertainty: number;
  readonly method: string;
  readonly instrumentReference: string;
  readonly calibrationReference: string;
  readonly surveyorId: string;
  readonly surveyAuthorityId: string;
  readonly collectedAt: string;
  readonly location: { readonly lat: number; readonly lon: number };
  readonly extent: SurveyExtent;
  readonly provenanceReference: string;
  readonly sourceDocumentId: string;
  readonly disposition: 'ACTIVE' | 'REVOKED' | 'INVALID';
  readonly finding: 'RECORDED' | 'SUSPECTED_BOTTLENECK';
  readonly supersedesMeasurementId: string | null;
}
export interface SurveyProof extends ProofBase {
  readonly kind: 'SURVEY';
  readonly surveyId: string;
  readonly measurements: readonly SurveyMeasurement[];
  readonly coverageDeclaration: 'WHOLE_EDGE' | 'PARTIAL';
  readonly reinspection: {
    readonly policyReference: string;
    readonly dueAt: string;
    readonly maximumAgeSeconds: number;
  };
  readonly supersedesProofId: string | null;
}
export type AuthoritativeProof =
  LegalBasisProof | StructureInventoryProof | SurveyProof;
