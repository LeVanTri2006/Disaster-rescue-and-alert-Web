import { loadIsolatedTestRegistry } from '../src/qualification-authority-registry';
import { verifyGraphArtifact } from '../src/qualification-artifact-verifier';
import { verifyProfileProvenance } from '../src/qualification-profile-verifier';
import { verifyEvidenceDocument } from '../src/qualification-document-verifier';
import { verifyValidity } from '../src/qualification-trusted-clock';
import {
  failure,
  metadata,
  VerificationStatus,
} from '../src/qualification-trust-types';
import { EdgeQualifier } from '../src/edge-qualifier';
import { verifyEdgeIdentity } from '../src/qualification-identity-binding';
import { productionAuthorityRegistry } from '../src/qualification-authority-registry';
import { verifySignedDocument } from '../src/qualification-crypto-verifier';
import { unavailableTrustedClock } from '../src/qualification-trusted-clock';
import { createCompleteInput } from './qualification-fixtures';
import { canonicalJson } from '../src/qualification-verification-json';
import { verificationFixture } from './qualification-verification-test-fixtures';

describe('5C.2A foundation never unlocks the 5C.1R engine', () => {
  it.each([true, false, undefined])(
    'valid technical receipts and production flag %s still give only UNVERIFIED',
    (requireProductionApproved) => {
      const f = verificationFixture(),
        binding = verifyEdgeIdentity(
          {
            binding: f.binding,
            graphVerification: f.graphVerification,
            profileVerification: f.profileVerification,
          },
          f.reading,
        );
      expect(f.registry.result.status).toBe('VERIFIED');
      expect(f.approvalDoc.result.status).toBe('VERIFIED');
      expect(f.graphVerification.status).toBe('VERIFIED');
      expect(f.profileVerification.status).toBe('VERIFIED');
      expect(binding.status).toBe('VERIFIED');
      const result = new EdgeQualifier().qualifyEdge({
        ...createCompleteInput(),
        requireProductionApproved,
        verificationResult: binding,
        verifiedGraphContext: f.graphVerification,
        verifiedProfileContext: f.profileVerification,
      } as ReturnType<typeof createCompleteInput>);
      expect(result).toMatchObject({
        purpose: 'DIAGNOSTIC_ONLY',
        trustStatus: 'UNAVAILABLE',
        qualificationStatus: 'UNVERIFIED',
        isProductionApproved: false,
      });
    },
  );
  it.each([
    { status: 'VERIFIED', productionAuthoritative: true },
    { trusted: true, graphVerified: true, clockTrusted: true },
  ])(
    'caller-constructed trusted result %j cannot unlock engine',
    (verificationResult) => {
      const input = { ...createCompleteInput(), verificationResult };
      expect(new EdgeQualifier().qualifyEdge(input).qualificationStatus).toBe(
        'UNVERIFIED',
      );
    },
  );
  it('no real PKI or production registry is configured', () => {
    const f = verificationFixture(),
      r = verifySignedDocument(
        f.manifestDoc.input,
        productionAuthorityRegistry(),
        f.reading,
      );
    expect(r.status).toBe('VERIFIER_UNAVAILABLE');
    expect(r.productionAuthoritative).toBe(false);
  });
  it('no trusted clock cannot produce issuer authenticity or qualification', () => {
    const f = verificationFixture(),
      r = verifySignedDocument(
        f.manifestDoc.input,
        f.registry.result,
        unavailableTrustedClock.read(),
      );
    expect(r.status).toBe('VERIFIER_UNAVAILABLE');
    expect(
      new EdgeQualifier().qualifyEdge(createCompleteInput())
        .isProductionApproved,
    ).toBe(false);
  });
  it('no verified graph context cannot produce identity binding', () => {
    const f = verificationFixture();
    expect(
      verifyEdgeIdentity(
        { binding: f.binding, profileVerification: f.profileVerification },
        f.reading,
      ).status,
    ).toBe('UNVERIFIED');
  });
  it('verification trace fields and disjoint assurance categories are explicit', () => {
    const f = verificationFixture();
    for (const r of [
      f.registry.result,
      f.approvalDoc.result,
      f.profileVerification,
      f.graphVerification,
    ]) {
      expect(r).toMatchObject({
        status: 'VERIFIED',
        scope: 'TEST_ONLY',
        policyVersion: 'qualification-verification-5C2C-v2',
        productionAuthoritative: false,
        qualificationEligible: false,
      });
      expect(r.verificationType.length).toBeGreaterThan(0);
      expect(r.subjectId.length).toBeGreaterThan(0);
      expect(r.verificationTimestamp).not.toBeNull();
      expect(r.trustSourceReference).not.toBeNull();
      expect(r.method.length).toBeGreaterThan(0);
      expect(r.artifactIdentity.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
  it('malformed verifier inputs return diagnostics and never default to VERIFIED', () => {
    const f = verificationFixture();
    for (const input of [null, undefined, []]) {
      const outputs = [
        verifySignedDocument(
          input as unknown as Parameters<typeof verifySignedDocument>[0],
          f.registry.result,
          f.reading,
        ),
        loadIsolatedTestRegistry(
          input as unknown as Parameters<typeof loadIsolatedTestRegistry>[0],
          f.reading,
        ),
        verifyGraphArtifact(
          input as unknown as Parameters<typeof verifyGraphArtifact>[0],
          f.reading,
        ),
        verifyProfileProvenance(
          input as unknown as Parameters<typeof verifyProfileProvenance>[0],
          f.reading,
        ),
        verifyEdgeIdentity(
          input as unknown as Parameters<typeof verifyEdgeIdentity>[0],
          f.reading,
        ),
        verifyValidity(
          input as unknown as Parameters<typeof verifyValidity>[0],
          f.reading,
        ),
        verifyEvidenceDocument(
          input as unknown as Parameters<typeof verifyEvidenceDocument>[0],
          f.reading,
        ).authenticity,
      ];
      for (const result of outputs) {
        expect(result.status).not.toBe('VERIFIED');
        expect(result.diagnosticCodes.length).toBeGreaterThan(0);
      }
    }
  });
  it('the exported failure helper cannot mint VERIFIED even through an invalid runtime cast', () => {
    const result = failure(
      metadata('FAULT', 'counterfeit'),
      'VERIFIED' as Exclude<VerificationStatus, 'VERIFIED'>,
      [],
    );
    expect(result.status).toBe('INVALID');
    expect(result.productionAuthoritative).toBe(false);
    expect(result.qualificationEligible).toBe(false);
  });
  it('canonical JSON rejects unsupported data instead of silently normalizing it', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const bad of [
      NaN,
      Infinity,
      undefined,
      { x: undefined },
      new Date(),
      cyclic,
      Array(1),
      Object.defineProperty({}, 'x', { get: () => 1, enumerable: true }),
    ])
      expect(() => canonicalJson(bad)).toThrow();
  });
});
