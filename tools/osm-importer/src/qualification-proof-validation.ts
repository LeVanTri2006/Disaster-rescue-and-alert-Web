import {
  ALL_QUALIFICATION_CRITERIA,
  GEOMETRY_HASH_VERSION,
  QUALIFICATION_POLICY_VERSION,
} from './qualification-types';
import {
  CRITERION_UNITS,
  isObject,
  isNonEmptyString,
  isFiniteNumber,
  isSha256,
  isValidIsoTimestamp,
} from './qualification-validation';
import {
  immutableJson,
  canonicalJson,
  parseJsonBytes,
} from './qualification-verification-json';
import {
  AuthoritativeProof,
  AuthoritativeReference,
  PROOF_SCHEMA,
  SurveyExtent,
} from './qualification-proof-types';
import { EdgeIdentityBinding } from './qualification-identity-binding';

class SchemaFault extends Error {}
function demand(condition: unknown, code: string): asserts condition {
  if (!condition) throw new SchemaFault(code);
}
function object(
  v: unknown,
  code = 'PROOF_OBJECT_REQUIRED',
): Record<string, unknown> {
  demand(isObject(v), code);
  return v;
}
function text(v: unknown, code: string): string {
  demand(isNonEmptyString(v), code);
  return v;
}
function hash(v: unknown, code: string): string {
  demand(isSha256(v), code);
  return v;
}
function utc(v: unknown, code: string): string {
  demand(isValidIsoTimestamp(v), code);
  return v;
}
function finite(v: unknown, code: string): number {
  demand(isFiniteNumber(v), code);
  return v;
}
function choice<T extends string>(
  v: unknown,
  values: readonly T[],
  code: string,
): T {
  const result = values.find((x) => x === v);
  demand(result !== undefined, code);
  return result;
}
function list(v: unknown, code: string): unknown[] {
  demand(Array.isArray(v), code);
  return v;
}
function unique(values: readonly string[], code: string) {
  demand(new Set(values).size === values.length, code);
}
export function parseProofBinding(v: unknown): EdgeIdentityBinding {
  const b = object(v, 'PROOF_BINDING_REQUIRED');
  demand(
    b.geometryHashVersion === GEOMETRY_HASH_VERSION,
    'PROOF_GEOMETRY_VERSION_MISMATCH',
  );
  demand(
    b.qualificationPolicyVersion === QUALIFICATION_POLICY_VERSION,
    'PROOF_POLICY_MISMATCH',
  );
  demand(typeof b.isWayForward === 'boolean', 'PROOF_DIRECTION_REQUIRED');
  demand(
    Number.isSafeInteger(b.osmWayId) && Number(b.osmWayId) > 0,
    'PROOF_OSM_WAY_INVALID',
  );
  return {
    graphVersion: text(b.graphVersion, 'PROOF_GRAPH_REQUIRED'),
    graphArtifactSha256: hash(
      b.graphArtifactSha256,
      'PROOF_GRAPH_DIGEST_INVALID',
    ),
    edgeId: text(b.edgeId, 'PROOF_EDGE_REQUIRED'),
    osmWayId: Number(b.osmWayId),
    fromNodeId: text(b.fromNodeId, 'PROOF_FROM_NODE_REQUIRED'),
    toNodeId: text(b.toNodeId, 'PROOF_TO_NODE_REQUIRED'),
    isWayForward: b.isWayForward,
    geometryHashVersion: GEOMETRY_HASH_VERSION,
    canonicalGeometryHash: hash(
      b.canonicalGeometryHash,
      'PROOF_GEOMETRY_DIGEST_INVALID',
    ),
    targetVehicleProfileId: text(
      b.targetVehicleProfileId,
      'PROOF_PROFILE_REQUIRED',
    ),
    targetVehicleProfileVersion: text(
      b.targetVehicleProfileVersion,
      'PROOF_PROFILE_VERSION_REQUIRED',
    ),
    vehicleConfigurationSha256: hash(
      b.vehicleConfigurationSha256,
      'PROOF_CONFIGURATION_DIGEST_INVALID',
    ),
    qualificationPolicyVersion: QUALIFICATION_POLICY_VERSION,
  };
}
export function parseSurveyExtent(v: unknown, length: number): SurveyExtent {
  const e = object(v, 'SURVEY_EXTENT_REQUIRED');
  if (e.kind === 'POINT') {
    const offset = finite(e.offset, 'SURVEY_OFFSET_INVALID');
    demand(offset >= 0 && offset <= length, 'SURVEY_OUTSIDE_EDGE');
    return { kind: 'POINT', offset };
  }
  demand(e.kind === 'SPAN', 'SURVEY_EXTENT_KIND_INVALID');
  const from = finite(e.from, 'SURVEY_SPAN_INVALID'),
    to = finite(e.to, 'SURVEY_SPAN_INVALID');
  demand(
    from >= 0 && to <= length && from < to,
    'SURVEY_SPAN_OUTSIDE_OR_REVERSED',
  );
  return { kind: 'SPAN', from, to };
}
export function validateAuthoritativeProof(
  value: unknown,
): Readonly<{
  valid: boolean;
  value?: AuthoritativeProof;
  diagnosticCodes: readonly string[];
}> {
  try {
    // Detach caller data and reject cycles, accessors, NaN and unsupported JSON.
    const p = object(parseJsonBytes(Buffer.from(canonicalJson(value))));
    demand(p.schema === PROOF_SCHEMA, 'PROOF_SCHEMA_UNSUPPORTED');
    const d = object(p.document, 'PROOF_DOCUMENT_REQUIRED'),
      rv = object(p.revocation, 'PROOF_REVOCATION_REQUIRED');
    const edgeLengthMeters = finite(
      p.edgeLengthMeters,
      'PROOF_EDGE_LENGTH_INVALID',
    );
    demand(edgeLengthMeters > 0, 'PROOF_EDGE_LENGTH_INVALID');
    const criterion = choice(
      p.criterion,
      ALL_QUALIFICATION_CRITERIA,
      'PROOF_CRITERION_INVALID',
    );
    const validFrom = utc(p.validFrom, 'PROOF_VALID_FROM_INVALID'),
      validUntil = utc(p.validUntil, 'PROOF_VALID_UNTIL_INVALID');
    demand(
      Date.parse(validFrom) <= Date.parse(validUntil),
      'PROOF_PERIOD_REVERSED',
    );
    const references: AuthoritativeReference[] = list(
      p.references,
      'PROOF_REFERENCES_REQUIRED',
    ).map((v) => {
      const r = object(v);
      return {
        documentId: text(r.documentId, 'REFERENCE_DOCUMENT_REQUIRED'),
        sha256: hash(r.sha256, 'REFERENCE_DIGEST_INVALID'),
        authorityId: text(r.authorityId, 'REFERENCE_AUTHORITY_REQUIRED'),
        role: choice(
          r.role,
          ['LEGAL', 'INVENTORY', 'INSPECTION', 'SURVEY', 'CALIBRATION'],
          'REFERENCE_ROLE_INVALID',
        ),
      };
    });
    unique(
      references.map((r) => r.documentId),
      'DUPLICATE_REFERENCE_ID',
    );
    const base = {
      schema: PROOF_SCHEMA,
      proofId: text(p.proofId, 'PROOF_ID_REQUIRED'),
      document: {
        documentId: text(d.documentId, 'PROOF_DOCUMENT_ID_REQUIRED'),
        authorityId: text(d.authorityId, 'PROOF_AUTHORITY_REQUIRED'),
        category: choice(
          d.category,
          ['LEGAL_PROOF', 'STRUCTURE_PROOF', 'SURVEY_PROOF'],
          'PROOF_DOCUMENT_CATEGORY_INVALID',
        ),
        sha256: hash(d.sha256, 'PROOF_DOCUMENT_DIGEST_INVALID'),
        signatureReference: text(
          d.signatureReference,
          'PROOF_SIGNATURE_REFERENCE_REQUIRED',
        ),
        registryId: text(d.registryId, 'PROOF_REGISTRY_REQUIRED'),
        snapshotId: text(d.snapshotId, 'PROOF_SNAPSHOT_REQUIRED'),
        keyId: text(d.keyId, 'PROOF_KEY_REQUIRED'),
      },
      binding: parseProofBinding(p.binding),
      criterion,
      edgeLengthMeters,
      validFrom,
      validUntil,
      revocation: {
        status: choice(
          rv.status,
          ['ACTIVE', 'REVOKED', 'UNKNOWN'],
          'PROOF_REVOCATION_STATUS_INVALID',
        ),
        reference: text(rv.reference, 'PROOF_REVOCATION_REFERENCE_REQUIRED'),
      },
      references,
      conflictStatus: choice(
        p.conflictStatus,
        ['NONE_DECLARED', 'UNRESOLVED'],
        'PROOF_CONFLICT_STATUS_INVALID',
      ),
    };
    let result: AuthoritativeProof;
    if (p.kind === 'LEGAL') {
      demand(d.category === 'LEGAL_PROOF', 'PROOF_KIND_CATEGORY_MISMATCH');
      const j = object(p.jurisdiction, 'LEGAL_JURISDICTION_REQUIRED');
      const edgeIds = list(j.edgeIds, 'LEGAL_EDGE_SCOPE_REQUIRED').map((v) =>
        text(v, 'LEGAL_EDGE_SCOPE_INVALID'),
      );
      unique(edgeIds, 'LEGAL_SCOPE_DUPLICATE_EDGE');
      demand(
        edgeIds.includes(base.binding.edgeId),
        'LEGAL_EDGE_OUTSIDE_JURISDICTION_CLAIM',
      );
      result = {
        ...base,
        kind: 'LEGAL',
        legalBasisReference: text(
          p.legalBasisReference,
          'LEGAL_REFERENCE_MISSING',
        ),
        jurisdiction: {
          jurisdictionId: text(j.jurisdictionId, 'LEGAL_JURISDICTION_REQUIRED'),
          geometryReference: text(
            j.geometryReference,
            'LEGAL_GEOMETRY_REFERENCE_REQUIRED',
          ),
          edgeIds,
        },
        structureId: text(p.structureId, 'LEGAL_STRUCTURE_REQUIRED'),
        applicabilityProviderReference:
          p.applicabilityProviderReference === null
            ? null
            : text(
                p.applicabilityProviderReference,
                'LEGAL_PROVIDER_REFERENCE_INVALID',
              ),
      };
    } else if (p.kind === 'STRUCTURE_INVENTORY') {
      demand(d.category === 'STRUCTURE_PROOF', 'PROOF_KIND_CATEGORY_MISMATCH');
      const structures = list(p.structures, 'STRUCTURE_LIST_REQUIRED').map(
        (v) => {
          const s = object(v);
          return {
            structureId: text(s.structureId, 'STRUCTURE_ID_REQUIRED'),
            type: choice(
              s.type,
              [
                'BRIDGE',
                'TUNNEL',
                'CULVERT',
                'CROSSING',
                'ROAD_STRUCTURE',
                'OTHER_LOAD_BEARING',
              ],
              'STRUCTURE_TYPE_INVALID',
            ),
            geometryReference: hash(
              s.geometryReference,
              'STRUCTURE_GEOMETRY_INVALID',
            ),
            extent: parseSurveyExtent(s.extent, edgeLengthMeters),
            surveyDocumentId: text(
              s.surveyDocumentId,
              'STRUCTURE_SURVEY_REFERENCE_REQUIRED',
            ),
            inspectionDocumentId: text(
              s.inspectionDocumentId,
              'STRUCTURE_INSPECTION_REFERENCE_REQUIRED',
            ),
            limitations: list(
              s.limitations,
              'STRUCTURE_LIMITATIONS_REQUIRED',
            ).map((v) => {
              const l = object(v),
                c = choice(
                  l.criterion,
                  ALL_QUALIFICATION_CRITERIA,
                  'STRUCTURE_LIMIT_CRITERION_INVALID',
                );
              const value = finite(l.value, 'STRUCTURE_LIMIT_INVALID'),
                uncertainty = finite(
                  l.uncertainty,
                  'STRUCTURE_LIMIT_UNCERTAINTY_INVALID',
                );
              demand(
                value >= 0 &&
                  uncertainty > 0 &&
                  Number.isFinite(value + uncertainty),
                'STRUCTURE_LIMIT_INVALID',
              );
              demand(
                l.unit === CRITERION_UNITS[c],
                'STRUCTURE_LIMIT_UNIT_INVALID',
              );
              return {
                criterion: c,
                value,
                uncertainty,
                unit: CRITERION_UNITS[c],
              };
            }),
          };
        },
      );
      unique(
        structures.map((s) => s.structureId),
        'DUPLICATE_STRUCTURE_ID',
      );
      demand(
        p.completeness === 'DECLARED_ONLY',
        'SELF_CLAIMED_AUTHORITATIVE_INVENTORY_REJECTED',
      );
      result = {
        ...base,
        kind: 'STRUCTURE_INVENTORY',
        inventoryId: text(p.inventoryId, 'INVENTORY_ID_REQUIRED'),
        inventoryVersion: text(
          p.inventoryVersion,
          'INVENTORY_VERSION_REQUIRED',
        ),
        completeness: 'DECLARED_ONLY',
        hiddenStructures: choice(
          p.hiddenStructures,
          ['UNKNOWN', 'DECLARED_COMPLETE'],
          'HIDDEN_STRUCTURE_STATUS_REQUIRED',
        ),
        osmBridgeTag: choice(
          p.osmBridgeTag,
          ['YES', 'NO', 'UNKNOWN'],
          'OSM_BRIDGE_CLAIM_INVALID',
        ),
        inventoryCoverage: list(
          p.inventoryCoverage,
          'INVENTORY_COVERAGE_REQUIRED',
        ).map((v) => parseSurveyExtent(v, edgeLengthMeters)),
        structures,
      };
    } else {
      demand(
        p.kind === 'SURVEY' && d.category === 'SURVEY_PROOF',
        'PROOF_KIND_CATEGORY_MISMATCH',
      );
      const measurements = list(
        p.measurements,
        'SURVEY_MEASUREMENTS_REQUIRED',
      ).map((v) => {
        const m = object(v),
          c = choice(
            m.criterion,
            ALL_QUALIFICATION_CRITERIA,
            'SURVEY_CRITERION_INVALID',
          );
        demand(c === criterion, 'SURVEY_CRITERION_MISMATCH');
        const value = finite(m.value, 'SURVEY_MEASUREMENT_INVALID'),
          uncertainty = finite(m.uncertainty, 'SURVEY_UNCERTAINTY_INVALID');
        demand(
          value >= 0 &&
            uncertainty > 0 &&
            Number.isFinite(value - uncertainty) &&
            Number.isFinite(value + uncertainty),
          'SURVEY_UNCERTAINTY_INVALID',
        );
        demand(m.unit === CRITERION_UNITS[c], 'SURVEY_UNIT_INVALID');
        const loc = object(m.location, 'SURVEY_LOCATION_REQUIRED'),
          lat = finite(loc.lat, 'SURVEY_LOCATION_INVALID'),
          lon = finite(loc.lon, 'SURVEY_LOCATION_INVALID');
        demand(
          Math.abs(lat) <= 90 && Math.abs(lon) <= 180,
          'SURVEY_LOCATION_INVALID',
        );
        const collectedAt = utc(
          m.collectedAt,
          'SURVEY_COLLECTION_TIME_INVALID',
        );
        demand(
          Date.parse(collectedAt) <= Date.parse(validUntil),
          'SURVEY_COLLECTION_AFTER_EXPIRY',
        );
        return {
          measurementId: text(
            m.measurementId,
            'SURVEY_MEASUREMENT_ID_REQUIRED',
          ),
          structureId: text(m.structureId, 'SURVEY_STRUCTURE_REQUIRED'),
          criterion: c,
          value,
          uncertainty,
          unit: CRITERION_UNITS[c],
          method: text(m.method, 'SURVEY_METHOD_MISSING'),
          instrumentReference: text(
            m.instrumentReference,
            'SURVEY_INSTRUMENT_MISSING',
          ),
          calibrationReference: text(
            m.calibrationReference,
            'SURVEY_CALIBRATION_MISSING',
          ),
          surveyorId: text(m.surveyorId, 'SURVEYOR_IDENTITY_MISSING'),
          surveyAuthorityId: text(
            m.surveyAuthorityId,
            'SURVEY_AUTHORITY_MISSING',
          ),
          collectedAt,
          location: { lat, lon },
          extent: parseSurveyExtent(m.extent, edgeLengthMeters),
          provenanceReference: text(
            m.provenanceReference,
            'SURVEY_PROVENANCE_MISSING',
          ),
          sourceDocumentId: text(
            m.sourceDocumentId,
            'SURVEY_SOURCE_DOCUMENT_MISSING',
          ),
          disposition: choice(
            m.disposition,
            ['ACTIVE', 'REVOKED', 'INVALID'],
            'SURVEY_DISPOSITION_REQUIRED',
          ),
          finding: choice(
            m.finding,
            ['RECORDED', 'SUSPECTED_BOTTLENECK'],
            'SURVEY_FINDING_REQUIRED',
          ),
          supersedesMeasurementId:
            m.supersedesMeasurementId === null
              ? null
              : text(
                  m.supersedesMeasurementId,
                  'SURVEY_SUPERSESSION_REFERENCE_INVALID',
                ),
        };
      });
      unique(
        measurements.map((m) => m.measurementId),
        'DUPLICATE_MEASUREMENT_ID',
      );
      const re = object(p.reinspection, 'REINSPECTION_POLICY_REQUIRED'),
        maximumAgeSeconds = finite(
          re.maximumAgeSeconds,
          'REINSPECTION_MAX_AGE_INVALID',
        );
      demand(
        maximumAgeSeconds > 0 &&
          Number.isSafeInteger(maximumAgeSeconds) &&
          Number.isSafeInteger(maximumAgeSeconds * 1000),
        'REINSPECTION_MAX_AGE_INVALID',
      );
      result = {
        ...base,
        kind: 'SURVEY',
        surveyId: text(p.surveyId, 'SURVEY_ID_REQUIRED'),
        measurements,
        coverageDeclaration: choice(
          p.coverageDeclaration,
          ['WHOLE_EDGE', 'PARTIAL'],
          'SURVEY_COVERAGE_DECLARATION_REQUIRED',
        ),
        reinspection: {
          policyReference: text(
            re.policyReference,
            'REINSPECTION_REFERENCE_REQUIRED',
          ),
          dueAt: utc(re.dueAt, 'REINSPECTION_DUE_INVALID'),
          maximumAgeSeconds,
        },
        supersedesProofId:
          p.supersedesProofId === null
            ? null
            : text(p.supersedesProofId, 'SURVEY_SUPERSEDES_PROOF_INVALID'),
      };
    }
    return immutableJson({
      valid: true,
      value: result,
      diagnosticCodes: ['PROOF_SCHEMA_VALID_NOT_AUTHORITATIVE'],
    });
  } catch (err: unknown) {
    return Object.freeze({
      valid: false,
      diagnosticCodes: Object.freeze([
        err instanceof SchemaFault
          ? err.message
          : 'PROOF_JSON_OR_SCHEMA_INVALID',
      ]),
    });
  }
}
