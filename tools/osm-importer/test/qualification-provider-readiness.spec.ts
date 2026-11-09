import {
  PROVIDER_KINDS,
  ProviderKind,
  unconfiguredProofProvider,
} from '../src/qualification-provider-contracts';
import {
  runProviderContractTest,
  evaluateProviderReadiness,
} from '../src/qualification-provider-readiness';
import {
  V3_ROOT,
  signedSnapshot,
  multiKeySnapshot,
} from './qualification-multikey-test-fixtures';
import {
  testClock,
  TEST_NOW,
} from './qualification-verification-test-fixtures';
import { isolatedTestClock } from '../src/qualification-trusted-clock';
import { rawSha256 } from '../src/qualification-verification-json';
function provider(kind: ProviderKind) {
  const signed = signedSnapshot(multiKeySnapshot());
  const descriptor = {
    kind,
    providerId: `ISOLATED_${kind}`,
    supportedContractVersions: ['TEST_CONTRACT_V1'],
    supportedPolicyVersions: ['TEST_POLICY_V1'],
    trustEstablishmentMethod: 'ISOLATED_TEST_ROOT',
    provenanceReference: 'ISOLATED_FIXTURE',
    maximumAgeSeconds: 3600,
    integrityRequirements:
      kind === 'TRUST_ROOTS'
        ? ['OUT_OF_BAND_ROOT']
        : kind === 'TRUSTED_TIME'
          ? ['RUNTIME_CLOCK_PROVENANCE']
          : ['RAW_SHA256', 'DETACHED_SIGNATURE'],
    revocationBehavior: 'FAIL_CLOSED',
    missingDataBehavior: 'FAIL_CLOSED',
    auditReferences: ['CONTRACT_TEST_AUDIT'],
  };
  const data =
    kind === 'TRUST_ROOTS'
      ? { rootReference: 'TEST_ROOT', publicKey: V3_ROOT.publicKey }
      : kind === 'TRUSTED_TIME'
        ? { reading: testClock() }
        : {
            ...signed,
            algorithm: 'Ed25519',
            sha256: rawSha256(signed.bytes),
            issuerId: 'TEST_ROOT',
            snapshotId: 'TEST_SNAPSHOT',
            observedAt: TEST_NOW,
            validUntil: '2026-06-01T01:00:00Z',
          };
  return {
    descriptor,
    read: async () => ({
      state: 'TEST_ONLY',
      data,
      auditReference: 'CONTRACT_AUDIT',
    }),
  };
}
describe('5C.2D provider contract availability and production readiness are separate', () => {
  it.each(PROVIDER_KINDS)(
    '%s without an actual provider stays NOT_CONFIGURED',
    async (kind) => {
      const result = await runProviderContractTest(
        unconfiguredProofProvider(kind),
        testClock(),
      );
      expect(result.state).toBe('NOT_CONFIGURED');
      expect(result.productionReady).toBe(false);
      expect(result.testOnlyIntegrationVerified).toBe(false);
    },
  );
  it.each(PROVIDER_KINDS)(
    '%s raw contract fixture is only TEST_ONLY roundtrip',
    async (kind) => {
      const result = await runProviderContractTest(provider(kind), testClock());
      expect(result.state).toBe('TEST_ONLY');
      expect(result.testOnlyContractVerified).toBe(true);
      expect(result.diagnosticCodes).toContain(
        'SEMANTIC_SIGNATURE_AND_AUTHORITY_INTEGRATION_NOT_VERIFIED',
      );
      expect(result.testOnlyIntegrationVerified).toBe(false);
      expect(result.trustRootsVerified).toBe(false);
      expect(result.productionReady).toBe(false);
    },
  );
  it('all nine interfaces and passing raw contract tests cannot unlock production readiness', async () => {
    const observations = await Promise.all(
      PROVIDER_KINDS.map((kind) =>
        runProviderContractTest(provider(kind), testClock()),
      ),
    );
    const out = evaluateProviderReadiness(observations);
    expect(out.overallProductionReadiness).toBe('BLOCKED');
    expect(out.productionApproved).toBe(false);
    expect(out.providers).toHaveLength(9);
    expect(
      out.providers.every(
        (p) => p.interfaceImplemented && p.testOnlyContractVerified,
      ),
    ).toBe(true);
    expect(
      out.providers.every(
        (p) =>
          !p.realFieldEvidenceAvailable &&
          !p.realAuthorityDataAvailable &&
          !p.externalTrustedClockAvailable &&
          !p.independentSafetyAuditCompleted,
      ),
    ).toBe(true);
    expect(evaluateProviderReadiness(observations.reverse())).toEqual(out);
  });
  it.each(['PRODUCTION_VERIFIED', 'true', 'ACTIVE'])(
    'self-claimed availability %s cannot establish trust',
    async (state) => {
      const p = provider('LEGAL_EVIDENCE'),
        out = await runProviderContractTest(
          { ...p, read: async () => ({ state, diagnosticCodes: [] }) },
          testClock(),
        );
      expect(out.state).toBe('INVALID');
      expect(out.productionReady).toBe(false);
      expect(out.diagnosticCodes).toContain(
        state === 'PRODUCTION_VERIFIED'
          ? 'PRODUCTION_VERIFIED_SELF_CLAIM_REJECTED'
          : 'PROVIDER_AVAILABILITY_INVALID',
      );
    },
  );
  it.each(['CONFIGURED_UNVERIFIED', 'UNAVAILABLE', 'INVALID'])(
    '%s is preserved as missing verification',
    async (state) => {
      const p = provider('LEGAL_EVIDENCE'),
        out = await runProviderContractTest(
          {
            ...p,
            read: async () => ({ state, diagnosticCodes: ['CLAIMED_ONLY'] }),
          },
          testClock(),
        );
      expect(out.state).toBe(state);
      expect(out.testOnlyContractVerified).toBe(false);
      expect(out.diagnosticCodes).toContain('PROVIDER_DATA_NOT_VERIFIED');
    },
  );
  it('forged readiness contract observations are rejected after JSON/spread/prototype manipulation', async () => {
    const genuine = await runProviderContractTest(
      provider('LEGAL_EVIDENCE'),
      testClock(),
    );
    for (const fake of [
      { ...genuine, productionReady: true },
      JSON.parse(JSON.stringify(genuine)),
      Object.create(genuine),
    ]) {
      const result = evaluateProviderReadiness([fake]);
      expect(result.overallProductionReadiness).toBe('BLOCKED');
      expect(result.diagnosticCodes).toContain(
        'PROVIDER_CONTRACT_RECEIPT_FORGED',
      );
    }
  });
  it('unavailable source exceptions do not leak messages or default to ready', async () => {
    const p = provider('SURVEY_EVIDENCE'),
      r = await runProviderContractTest(
        {
          ...p,
          read: async () => {
            throw new Error('SECRET_PROVIDER_BODY');
          },
        },
        testClock(),
      );
    expect(r.state).toBe('UNAVAILABLE');
    expect(r.diagnosticCodes).toContain('PROVIDER_CONTRACT_EXCEPTION');
    expect(JSON.stringify(r)).not.toContain('SECRET_PROVIDER_BODY');
  });
  it('provider bytes matching a claimed status are still checked for digest integrity', async () => {
    const p = provider('GRAPH_ARTIFACT'),
      reply = await p.read();
    const r = await runProviderContractTest(
      {
        ...p,
        read: async () => ({
          ...reply,
          data: { ...reply.data, sha256: 'a'.repeat(64) },
        }),
      },
      testClock(),
    );
    expect(r.state).toBe('INVALID');
    expect(r.diagnosticCodes).toContain('PROVIDER_ARTIFACT_INTEGRITY_INVALID');
  });
  it('stale data cannot pass a current contract check', async () => {
    const p = provider('SURVEY_EVIDENCE'),
      r = await runProviderContractTest(
        p,
        isolatedTestClock('2026-06-01T02:00:00Z').read(),
      );
    expect(r.state).toBe('UNAVAILABLE');
    expect(r.diagnosticCodes).toContain('PROVIDER_DATA_STALE_OR_EXPIRED');
  });
  it('a fake clock payload is not a trusted external time provider', async () => {
    const p = provider('TRUSTED_TIME'),
      r = await runProviderContractTest(
        {
          ...p,
          read: async () => ({
            state: 'TEST_ONLY',
            auditReference: 'TEST',
            data: { reading: { kind: 'TEST_ONLY', timestamp: TEST_NOW } },
          }),
        },
        testClock(),
      );
    expect(r.state).toBe('INVALID');
    expect(r.diagnosticCodes).toContain('PROVIDER_CLOCK_PROVENANCE_INVALID');
  });
  it('descriptor omissions and non-finite freshness are invalid', async () => {
    const p = provider('AUTHORITY_REGISTRY');
    for (const patch of [
      { provenanceReference: '' },
      { maximumAgeSeconds: Infinity },
      { maximumAgeSeconds: 1e300 },
      { missingDataBehavior: 'ACCEPT' },
    ]) {
      const r = await runProviderContractTest(
        { ...p, descriptor: { ...p.descriptor, ...patch } },
        testClock(),
      );
      expect(r.state).toBe('INVALID');
      expect(r.diagnosticCodes).toContain('PROVIDER_DESCRIPTOR_INVALID');
    }
  });
});
