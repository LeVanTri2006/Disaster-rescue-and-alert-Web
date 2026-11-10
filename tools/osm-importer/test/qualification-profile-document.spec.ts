import {
  profileConfigurationIdentity,
  verifyProfileProvenance,
} from '../src/qualification-profile-verifier';
import { verifyEvidenceDocument } from '../src/qualification-document-verifier';
import { rawSha256 } from '../src/qualification-verification-json';
import {
  createCompleteInput,
  createMockNotApplicableEvidence,
} from './qualification-fixtures';
import {
  signedDocument,
  testEnvelope,
  TEST_AUTHORITY,
  verificationFixture,
} from './qualification-verification-test-fixtures';

function evidenceFixture(category: 'EVIDENCE' | 'EXEMPTION' = 'EVIDENCE') {
  const f = verificationFixture(),
    baseline = createCompleteInput();
  const draft =
    category === 'EVIDENCE'
      ? {
          ...baseline.evidenceRecords[3],
          evidenceId: 'SIGNED_EVIDENCE',
          sourceAuthorityId: TEST_AUTHORITY,
          graphVersion: f.binding.graphVersion,
          graphArtifactSha256: f.binding.graphArtifactSha256,
        }
      : createMockNotApplicableEvidence({
          evidenceId: 'SIGNED_EXEMPTION',
          criterion: 'STRUCTURAL_LOAD_CAPACITY',
          edgeId: baseline.edge.id,
          canonicalGeometryHash:
            baseline.evidenceRecords[3].canonicalGeometryHash,
          graphVersion: f.binding.graphVersion,
          graphArtifactSha256: f.binding.graphArtifactSha256,
        });
  const projection = Object.fromEntries(
    Object.entries(draft).filter(
      ([k, v]) =>
        k !== 'documentSha256' &&
        k !== 'digitalSignatureStatus' &&
        v !== undefined,
    ),
  );
  const doc = signedDocument(
    testEnvelope({
      subjectId: draft.evidenceId,
      category,
      criterion: draft.criterion,
      validFrom: 'validFrom' in draft ? draft.validFrom : draft.verifiedAt,
      validUntil: draft.validUntil,
      body: { record: projection },
    }),
    f.registry.result,
    f.reading,
  );
  const record = { ...draft, documentSha256: rawSha256(doc.bytes) };
  return {
    ...f,
    record,
    doc,
    input: {
      category,
      record,
      documentBytes: doc.bytes,
      documentVerification: doc.result,
      edgeMetadata: baseline.edge.metadata,
    },
  };
}
describe('5C.2A canonical vehicle configuration and approval binding', () => {
  it('profile has a versioned deterministic canonical configuration digest', () => {
    const f = verificationFixture(),
      r = f.profileVerification;
    expect(r).toMatchObject({
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      productionAuthoritative: false,
      details: {
        configurationSha256: f.configIdentity.sha256,
        configurationDigestVersion: 'rescue-vehicle-configuration-v1',
      },
    });
    const reordered = Object.fromEntries(Object.entries(f.profile).reverse());
    expect(profileConfigurationIdentity(reordered)).toEqual(f.configIdentity);
  });
  it.each([
    'overallHeightMeters',
    'overallWidthMeters',
    'grossWeightTons',
    'maxAxleWeightTons',
    'fordingDepthMeters',
    'groundClearanceMeters',
    'turningRadiusMeters',
  ])(
    'changing %s with the same profile version invalidates existing approval',
    (field) => {
      const f = verificationFixture(),
        profile = {
          ...f.profile,
          [field]: Number(f.profile[field as keyof typeof f.profile]) + 0.1,
        };
      expect(profileConfigurationIdentity(profile).sha256).not.toBe(
        f.configIdentity.sha256,
      );
      expect(
        verifyProfileProvenance(
          {
            profile,
            documentBytes: f.approvalDoc.bytes,
            documentVerification: f.approvalDoc.result,
          },
          f.reading,
        ).diagnosticCodes,
      ).toContain('PROFILE_CONFIGURATION_DIGEST_MISMATCH');
    },
  );
  it('different profile ID cannot reuse approval', () => {
    const f = verificationFixture();
    expect(
      verifyProfileProvenance(
        {
          profile: { ...f.profile, profileId: 'OTHER' },
          documentBytes: f.approvalDoc.bytes,
          documentVerification: f.approvalDoc.result,
        },
        f.reading,
      ).status,
    ).toBe('INVALID');
  });
  it('provenance version mismatch is rejected before binding', () => {
    const f = verificationFixture(),
      profile = {
        ...f.profile,
        approvalProvenance: {
          ...f.profile.approvalProvenance,
          profileVersion: '99.0.0',
        },
      };
    expect(
      verifyProfileProvenance(
        {
          profile,
          documentBytes: f.approvalDoc.bytes,
          documentVerification: f.approvalDoc.result,
        },
        f.reading,
      ).diagnosticCodes,
    ).toContain('PROFILE_VERSION_MISMATCH');
  });
  it.each(['expired', 'revoked'])(
    '%s approval cannot bind a profile',
    (kind) => {
      const f = verificationFixture(),
        profile = {
          ...f.profile,
          approvalProvenance: {
            ...f.profile.approvalProvenance,
            ...(kind === 'expired'
              ? { effectiveUntil: '2026-05-01T00:00:00Z' }
              : { revocationStatus: 'REVOKED_SAFETY_NOTICE' as const }),
          },
        };
      expect(
        verifyProfileProvenance(
          {
            profile,
            documentBytes: f.approvalDoc.bytes,
            documentVerification: f.approvalDoc.result,
          },
          f.reading,
        ).status,
      ).toBe(kind === 'expired' ? 'EXPIRED' : 'REVOKED');
    },
  );
  it('ACTIVE_APPROVED alone cannot authenticate profile provenance', () => {
    const f = verificationFixture();
    expect(
      verifyProfileProvenance(
        { profile: f.profile, documentBytes: f.approvalDoc.bytes },
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
  });
  it('caller-forged profile approval receipt cannot authenticate a profile', () => {
    const f = verificationFixture();
    expect(
      verifyProfileProvenance(
        {
          profile: f.profile,
          documentBytes: f.approvalDoc.bytes,
          documentVerification: { ...f.approvalDoc.result },
        },
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
  });
  it('truncated approval document bytes are INVALID', () => {
    const f = verificationFixture();
    expect(
      verifyProfileProvenance(
        {
          profile: f.profile,
          documentBytes: f.approvalDoc.bytes.subarray(0, -1),
          documentVerification: f.approvalDoc.result,
        },
        f.reading,
      ).diagnosticCodes,
    ).toContain('APPROVAL_DOCUMENT_DIGEST_MISMATCH');
  });
  it('missing approval bytes never becomes VERIFIED from a claimed hash', () => {
    const f = verificationFixture();
    expect(
      verifyProfileProvenance(
        { profile: f.profile, documentVerification: f.approvalDoc.result },
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
  });
  it('changed provenance document reference cannot reuse signed approval', () => {
    const f = verificationFixture(),
      profile = {
        ...f.profile,
        approvalProvenance: {
          ...f.profile.approvalProvenance,
          documentReferenceNumber: 'FORGED',
        },
      };
    expect(
      verifyProfileProvenance(
        {
          profile,
          documentBytes: f.approvalDoc.bytes,
          documentVerification: f.approvalDoc.result,
        },
        f.reading,
      ).diagnosticCodes,
    ).toContain('PROFILE_APPROVAL_PROVENANCE_MISMATCH');
  });
});

describe('5C.2A document integrity is distinct from issuer authenticity', () => {
  it.each(['EVIDENCE', 'EXEMPTION'] as const)(
    '%s bytes and exact signed record verify only under isolated test registry',
    (category) => {
      const f = evidenceFixture(category),
        r = verifyEvidenceDocument(f.input, f.reading);
      expect(r.integrity).toMatchObject({
        status: 'VERIFIED',
        assurance: 'TEST_BYTE_INTEGRITY',
        qualificationEligible: false,
      });
      expect(r.authenticity).toMatchObject({
        status: 'VERIFIED',
        scope: 'TEST_ONLY',
        assurance: 'TEST_DOCUMENT_AUTHENTICITY',
        productionAuthoritative: false,
      });
    },
  );
  it('matching caller hash without a trusted reference is not verified integrity or authenticity', () => {
    const f = evidenceFixture(),
      r = verifyEvidenceDocument(
        { ...f.input, documentVerification: undefined },
        f.reading,
      );
    expect(r.integrity.status).toBe('UNVERIFIED');
    expect(r.integrity.details?.computedDigest).toBe(f.record.documentSha256);
    expect(r.authenticity.status).toBe('UNVERIFIED');
  });
  it('only a hash without source bytes cannot verify either property', () => {
    const f = evidenceFixture(),
      r = verifyEvidenceDocument(
        { ...f.input, documentBytes: undefined },
        f.reading,
      );
    expect(r.integrity.status).toBe('UNVERIFIED');
    expect(r.authenticity.status).toBe('UNVERIFIED');
  });
  it.each(['truncate', 'tamper'])(
    '%s source bytes invalidates document integrity',
    (mode) => {
      const f = evidenceFixture(),
        bytes = Buffer.from(f.doc.bytes);
      bytes[0] ^= 1;
      expect(
        verifyEvidenceDocument(
          {
            ...f.input,
            documentBytes:
              mode === 'truncate' ? f.doc.bytes.subarray(0, -1) : bytes,
          },
          f.reading,
        ).integrity.diagnosticCodes,
      ).toContain('DOCUMENT_CLAIMED_DIGEST_MISMATCH');
    },
  );
  it('verified byte integrity does not bless a changed measurement or graph binding', () => {
    const f = evidenceFixture();
    for (const patch of [
      { measuredValue: 99 },
      { graphVersion: 'OLD' },
      { canonicalGeometryHash: 'a'.repeat(64) },
      { evidenceId: 'OTHER' },
    ]) {
      const r = verifyEvidenceDocument(
        { ...f.input, record: { ...f.record, ...patch } },
        f.reading,
      );
      expect(r.integrity.status).toBe('VERIFIED');
      expect(r.authenticity.status).toBe('INVALID');
      expect(r.authenticity.diagnosticCodes).toContain(
        'SIGNED_RECORD_BINDING_MISMATCH',
      );
    }
  });
  it('document signature receipt from another document cannot establish integrity', () => {
    const f = evidenceFixture(),
      other = signedDocument(testEnvelope(), f.registry.result, f.reading);
    expect(
      verifyEvidenceDocument(
        { ...f.input, documentVerification: other.result },
        f.reading,
      ).integrity.diagnosticCodes,
    ).toContain('DOCUMENT_RECEIPT_BYTES_MISMATCH');
  });
  it('revoked record is not promoted by matching document bytes', () => {
    const f = evidenceFixture(),
      r = verifyEvidenceDocument(
        { ...f.input, record: { ...f.record, revocationStatus: 'REVOKED' } },
        f.reading,
      );
    expect(r.authenticity.status).toBe('REVOKED');
  });
  it('forged verification result is rejected at document authenticity boundary', () => {
    const f = evidenceFixture(),
      r = verifyEvidenceDocument(
        {
          ...f.input,
          documentVerification: JSON.parse(JSON.stringify(f.doc.result)),
        },
        f.reading,
      );
    expect(r.integrity.status).toBe('UNVERIFIED');
    expect(r.authenticity.status).toBe('UNVERIFIED');
  });
});
