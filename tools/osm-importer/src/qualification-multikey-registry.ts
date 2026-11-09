/** v3 is a NEW isolated protocol. v2 consumers and signed-byte meaning stay unchanged. */
import { createPublicKey, KeyObject, verify } from 'node:crypto';
import { ClockProvider, inspectClock } from './qualification-trusted-clock';
import {
  canonicalJson,
  immutableJson,
  parseJsonBytes,
  rawSha256,
  strictBase64,
} from './qualification-verification-json';
import {
  ALL_QUALIFICATION_CRITERIA,
  QualificationCriterion,
} from './qualification-types';
import {
  isObject,
  isNonEmptyString,
  isValidIsoTimestamp,
  isSha256,
} from './qualification-validation';
import {
  LifecycleStatus,
  LIFECYCLE_STATUSES,
} from './qualification-revocation-policy';
import {
  RegistryCheckpoint,
  TrustedRegistryCheckpointStore,
} from './qualification-registry-checkpoint';

export const MULTIKEY_POLICY = 'qualification-multikey-test-v1' as const;
export const MULTIKEY_SCHEMA = 'qualification-test-registry-v3' as const;
export const MULTIKEY_CATEGORIES = [
  'LEGAL_PROOF',
  'STRUCTURE_PROOF',
  'SURVEY_PROOF',
  'GRAPH_MANIFEST',
  'PROFILE_APPROVAL',
  'EVIDENCE',
  'EXEMPTION',
] as const;
export type MultiKeyCategory = (typeof MULTIKEY_CATEGORIES)[number];
export interface MultiKeyRecord {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly algorithm: 'Ed25519';
  readonly publicKeyPem: string;
  readonly publicKeySha256: string;
  readonly activatedAt: string;
  readonly signingUntil: string;
  readonly keyStatus: LifecycleStatus;
  readonly revokedAt: string | null;
  readonly replacesKeyId: string | null;
  readonly allowedCategories: readonly MultiKeyCategory[];
  readonly allowedCriteria: readonly QualificationCriterion[];
}
export interface MultiKeyAuthority {
  readonly authorityId: string;
  readonly name: string;
  readonly authorityStatus: LifecycleStatus;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly revokedAt: string | null;
  readonly allowedCategories: readonly MultiKeyCategory[];
  readonly allowedCriteria: readonly QualificationCriterion[];
  readonly keys: readonly MultiKeyRecord[];
}
export interface MultiKeySnapshot {
  readonly schema: typeof MULTIKEY_SCHEMA;
  readonly policyVersion: typeof MULTIKEY_POLICY;
  readonly registryId: string;
  readonly snapshotId: string;
  readonly snapshotVersion: number;
  readonly previousSnapshotSha256: string | null;
  readonly createdAt: string;
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly revocationCheckedAt: string;
  readonly revocationSourceStatus: 'AVAILABLE';
  readonly rotationPolicy: 'ALLOW_EXPLICIT_OVERLAP';
  readonly authorities: readonly MultiKeyAuthority[];
  readonly revokedDocumentIds: readonly string[];
}
export interface MultiKeyEnvelope {
  readonly registryId: string;
  readonly snapshotId: string;
  readonly schema: 'qualification-multikey-document-v1';
  readonly subjectId: string;
  readonly authorityId: string;
  readonly keyId: string;
  readonly category: MultiKeyCategory;
  readonly criterion: QualificationCriterion | null;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly claimedSigningTime: string | null;
  readonly body: Readonly<Record<string, unknown>>;
}
export interface MultiKeyDocumentClaim {
  readonly bytes: Uint8Array;
  readonly signatureBase64: string;
  readonly algorithm: 'Ed25519';
  readonly keyId: string;
  readonly authorityId: string;
}
export interface MultiKeyObservation<T> {
  readonly status: 'VERIFIED_TEST_ONLY' | 'REJECTED' | 'UNAVAILABLE';
  readonly scope: 'TEST_ONLY';
  readonly policyVersion: typeof MULTIKEY_POLICY;
  readonly productionAuthoritative: false;
  readonly qualificationEligible: false;
  readonly diagnosticCodes: readonly string[];
  readonly timestamp: string | null;
  readonly subjectReference: string;
  readonly trustSourceReference: string | null;
  readonly details?: T;
}
export interface RegistryIdentity {
  readonly registryId: string;
  readonly snapshotId: string;
  readonly snapshotVersion: number;
  readonly sha256: string;
  readonly checkpointDurability: 'PROCESS_ONLY' | 'EXTERNAL_DURABLE';
}
export interface MultiKeyDocumentIdentity {
  readonly envelope: MultiKeyEnvelope;
  readonly documentSha256: string;
  readonly keyFingerprint: string;
  readonly registry: RegistryIdentity;
  readonly signingTime: 'UNAUTHENTICATED';
}
interface RegistryState {
  readonly owner: object;
  readonly snapshot: MultiKeySnapshot;
  readonly identity: RegistryIdentity;
  readonly scopeKey: string;
  readonly store: TrustedRegistryCheckpointStore;
}
interface DocumentState {
  readonly registry: unknown;
  readonly owner: object;
  readonly identity: MultiKeyDocumentIdentity;
}
const issuedFailureCodes = new WeakMap<object, readonly string[]>();
const evaluationTimes = new WeakMap<object, number>();
const registryReceipts = new WeakMap<object, RegistryState>(),
  documentReceipts = new WeakMap<object, DocumentState>();
class ContractError extends Error {}
function requireValue(condition: unknown, code: string): asserts condition {
  if (!condition) throw new ContractError(code);
}
function obj(v: unknown): Record<string, unknown> {
  requireValue(isObject(v), 'REGISTRY_OBJECT_INVALID');
  return v;
}
function str(v: unknown, code: string): string {
  requireValue(isNonEmptyString(v), code);
  return v;
}
function utc(v: unknown): string {
  requireValue(isValidIsoTimestamp(v), 'REGISTRY_UTC_INVALID');
  return v;
}
function num(v: unknown): number {
  requireValue(
    typeof v === 'number' && Number.isSafeInteger(v) && v > 0,
    'REGISTRY_VERSION_INVALID',
  );
  return v;
}
function pick<T extends string>(
  v: unknown,
  options: readonly T[],
  code: string,
): T {
  const found = options.find((x) => x === v);
  requireValue(found !== undefined, code);
  return found;
}
function array(v: unknown): unknown[] {
  requireValue(Array.isArray(v), 'REGISTRY_ARRAY_REQUIRED');
  return v;
}
function strings(v: unknown): string[] {
  const values = array(v).map((x) => str(x, 'REGISTRY_ID_INVALID'));
  requireValue(
    new Set(values).size === values.length,
    'REGISTRY_DUPLICATE_REFERENCE',
  );
  return values;
}
function permissions<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  return strings(v).map((s) => pick(s, allowed, 'REGISTRY_PERMISSION_INVALID'));
}
function optionalUtc(v: unknown) {
  return v === null ? null : utc(v);
}
function interval(from: string, until: string) {
  requireValue(
    Date.parse(from) <= Date.parse(until),
    'REGISTRY_PERIOD_REVERSED',
  );
}
function fingerprint(pem: string) {
  const key = createPublicKey(pem);
  requireValue(
    key.type === 'public' && key.asymmetricKeyType === 'ed25519',
    'KEY_ALGORITHM_INVALID',
  );
  return rawSha256(key.export({ type: 'spki', format: 'der' }));
}
function parseSnapshot(value: unknown): MultiKeySnapshot {
  const s = obj(value);
  requireValue(
    s.schema === MULTIKEY_SCHEMA,
    'MULTIKEY_REGISTRY_VERSION_UNSUPPORTED',
  );
  requireValue(s.policyVersion === MULTIKEY_POLICY, 'MULTIKEY_POLICY_MISMATCH');
  requireValue(
    s.revocationSourceStatus === 'AVAILABLE',
    'REVOCATION_SOURCE_UNAVAILABLE',
  );
  requireValue(
    s.rotationPolicy === 'ALLOW_EXPLICIT_OVERLAP',
    'ROTATION_POLICY_REQUIRED',
  );
  const authorityIds = new Set<string>(),
    keyIds = new Set<string>(),
    identities = new Set<string>();
  const authorities = array(s.authorities).map((v) => {
    const a = obj(v),
      authorityId = str(a.authorityId, 'AUTHORITY_ID_REQUIRED');
    requireValue(!authorityIds.has(authorityId), 'DUPLICATE_AUTHORITY_ID');
    authorityIds.add(authorityId);
    const allowedCategories = permissions(
        a.allowedCategories,
        MULTIKEY_CATEGORIES,
      ),
      allowedCriteria = permissions(
        a.allowedCriteria,
        ALL_QUALIFICATION_CRITERIA,
      );
    const versions = new Set<number>();
    const keys = array(a.keys).map((v) => {
      const k = obj(v),
        keyId = str(k.keyId, 'KEY_ID_REQUIRED'),
        keyVersion = num(k.keyVersion);
      requireValue(!keyIds.has(keyId), 'DUPLICATE_KEY_ID');
      requireValue(!versions.has(keyVersion), 'DUPLICATE_KEY_VERSION');
      keyIds.add(keyId);
      versions.add(keyVersion);
      requireValue(k.algorithm === 'Ed25519', 'KEY_ALGORITHM_INVALID');
      const publicKeyPem =
          typeof k.publicKeyPem === 'string' ? k.publicKeyPem : '',
        computed = fingerprint(publicKeyPem);
      requireValue(
        k.publicKeySha256 === computed,
        'KEY_PUBLIC_IDENTITY_MISMATCH',
      );
      requireValue(
        !identities.has(computed),
        'SIGNING_IDENTITY_ALIAS_REJECTED',
      );
      identities.add(computed);
      const activatedAt = utc(k.activatedAt),
        signingUntil = utc(k.signingUntil);
      interval(activatedAt, signingUntil);
      const categories = permissions(k.allowedCategories, MULTIKEY_CATEGORIES),
        criteria = permissions(k.allowedCriteria, ALL_QUALIFICATION_CRITERIA);
      requireValue(
        categories.every((c) => allowedCategories.includes(c)) &&
          criteria.every((c) => allowedCriteria.includes(c)),
        'KEY_PERMISSION_ESCALATION',
      );
      return {
        keyId,
        keyVersion,
        algorithm: 'Ed25519' as const,
        publicKeyPem,
        publicKeySha256: computed,
        activatedAt,
        signingUntil,
        keyStatus: pick(k.keyStatus, LIFECYCLE_STATUSES, 'KEY_STATUS_REQUIRED'),
        revokedAt: optionalUtc(k.revokedAt),
        replacesKeyId:
          k.replacesKeyId === null
            ? null
            : str(k.replacesKeyId, 'KEY_REPLACEMENT_INVALID'),
        allowedCategories: categories,
        allowedCriteria: criteria,
      };
    });
    requireValue(keys.length > 0, 'AUTHORITY_KEYS_MISSING');
    for (const key of keys)
      if (key.replacesKeyId) {
        const previous = keys.find((k) => k.keyId === key.replacesKeyId);
        requireValue(
          previous &&
            previous.keyVersion < key.keyVersion &&
            Date.parse(previous.activatedAt) <= Date.parse(key.activatedAt),
          'KEY_REPLACEMENT_CHAIN_INVALID',
        );
      }
    const validFrom = utc(a.validFrom),
      validUntil = utc(a.validUntil);
    interval(validFrom, validUntil);
    requireValue(
      keys.every(
        (k) =>
          Date.parse(k.activatedAt) >= Date.parse(validFrom) &&
          Date.parse(k.signingUntil) <= Date.parse(validUntil),
      ),
      'KEY_OUTSIDE_AUTHORITY_PERIOD',
    );
    return {
      authorityId,
      name: str(a.name, 'AUTHORITY_NAME_REQUIRED'),
      authorityStatus: pick(
        a.authorityStatus,
        LIFECYCLE_STATUSES,
        'AUTHORITY_STATUS_REQUIRED',
      ),
      validFrom,
      validUntil,
      revokedAt: optionalUtc(a.revokedAt),
      allowedCategories,
      allowedCriteria,
      keys,
    };
  });
  const createdAt = utc(s.createdAt),
    effectiveAt = utc(s.effectiveAt),
    expiresAt = utc(s.expiresAt),
    revocationCheckedAt = utc(s.revocationCheckedAt);
  interval(createdAt, effectiveAt);
  interval(effectiveAt, expiresAt);
  requireValue(
    s.previousSnapshotSha256 === null || isSha256(s.previousSnapshotSha256),
    'PREVIOUS_SNAPSHOT_REFERENCE_INVALID',
  );
  return immutableJson({
    schema: MULTIKEY_SCHEMA,
    policyVersion: MULTIKEY_POLICY,
    registryId: str(s.registryId, 'REGISTRY_ID_REQUIRED'),
    snapshotId: str(s.snapshotId, 'SNAPSHOT_ID_REQUIRED'),
    snapshotVersion: num(s.snapshotVersion),
    previousSnapshotSha256: s.previousSnapshotSha256,
    createdAt,
    effectiveAt,
    expiresAt,
    revocationCheckedAt,
    revocationSourceStatus: 'AVAILABLE',
    rotationPolicy: 'ALLOW_EXPLICIT_OVERLAP',
    authorities,
    revokedDocumentIds: strings(s.revokedDocumentIds),
  });
}
function observation<T>(
  status: MultiKeyObservation<T>['status'],
  codes: readonly string[],
  reading: unknown,
  subject: string,
  source: string | null,
  details?: T,
): MultiKeyObservation<T> {
  const result = immutableJson({
    status,
    scope: 'TEST_ONLY' as const,
    policyVersion: MULTIKEY_POLICY,
    productionAuthoritative: false as const,
    qualificationEligible: false as const,
    diagnosticCodes: [...new Set(codes)].sort(),
    timestamp: inspectClock(reading)?.timestamp ?? null,
    subjectReference: `sha256:${rawSha256(Buffer.from(subject))}`,
    trustSourceReference: source,
    ...(details === undefined ? {} : { details }),
  });
  if (status !== 'VERIFIED_TEST_ONLY')
    issuedFailureCodes.set(result, result.diagnosticCodes);
  return result;
}
function monotonicTime(owner: object, reading: unknown): string[] {
  const clock = inspectClock(reading);
  if (!clock || clock.kind !== 'TEST_ONLY' || !clock.timestamp)
    return ['TEST_CLOCK_REQUIRED'];
  const at = Date.parse(clock.timestamp),
    previous = evaluationTimes.get(owner);
  if (previous !== undefined && at < previous) return ['CLOCK_ROLLBACK'];
  evaluationTimes.set(owner, at);
  return [];
}
function snapshotReasons(state: RegistryState, reading: unknown): string[] {
  const clock = inspectClock(reading),
    s = state.snapshot;
  if (!clock || clock.kind !== 'TEST_ONLY' || !clock.timestamp)
    return ['TEST_CLOCK_REQUIRED'];
  const at = Date.parse(clock.timestamp),
    codes: string[] = [...monotonicTime(state.owner, reading)];
  if (at < Date.parse(s.effectiveAt) || at > Date.parse(s.expiresAt))
    codes.push('REGISTRY_OUTSIDE_EFFECTIVE_PERIOD');
  if (
    at < Date.parse(s.createdAt) ||
    at - Date.parse(s.revocationCheckedAt) < 0 ||
    at - Date.parse(s.revocationCheckedAt) > 3600000
  )
    codes.push('REVOCATION_SNAPSHOT_STALE');
  try {
    const head = state.store.read(state.scopeKey);
    if (
      head.status !== 'FOUND' ||
      head.checkpoint.sha256 !== state.identity.sha256 ||
      head.checkpoint.snapshotVersion !== s.snapshotVersion
    )
      codes.push('REGISTRY_RECEIPT_SUPERSEDED_OR_CHECKPOINT_UNAVAILABLE');
  } catch {
    codes.push('TRUSTED_CHECKPOINT_UNAVAILABLE');
  }
  return codes;
}
function authorize(
  state: RegistryState,
  reading: unknown,
  authorityId: string,
  keyId: string,
  category: MultiKeyCategory,
  criterion: QualificationCriterion | null,
  subjectId: string,
) {
  const codes = snapshotReasons(state, reading),
    clock = inspectClock(reading);
  const at = clock?.timestamp ? Date.parse(clock.timestamp) : NaN;
  const authority = state.snapshot.authorities.find(
      (a) => a.authorityId === authorityId,
    ),
    key = authority?.keys.find((k) => k.keyId === keyId);
  if (!authority) codes.push('AUTHORITY_NOT_REGISTERED');
  else {
    const status =
      authority.revokedAt && at >= Date.parse(authority.revokedAt)
        ? 'REVOKED'
        : authority.authorityStatus;
    if (status !== 'ACTIVE') codes.push(`AUTHORITY_${status}`);
    if (
      at < Date.parse(authority.validFrom) ||
      at > Date.parse(authority.validUntil)
    )
      codes.push('AUTHORITY_EXPIRED_OR_NOT_ACTIVE');
    if (
      !authority.allowedCategories.includes(category) ||
      (criterion !== null && !authority.allowedCriteria.includes(criterion))
    )
      codes.push('AUTHORITY_PERMISSION_DENIED');
  }
  if (!key) codes.push('KEY_NOT_REGISTERED');
  else {
    const status =
      key.revokedAt && at >= Date.parse(key.revokedAt)
        ? 'REVOKED'
        : key.keyStatus;
    if (status !== 'ACTIVE') codes.push(`KEY_${status}`);
    if (at < Date.parse(key.activatedAt)) codes.push('KEY_NOT_ACTIVATED');
    if (at > Date.parse(key.signingUntil) || status === 'EXPIRED')
      codes.push(
        'KEY_NOT_AUTHORIZED_FOR_NEW_SIGNATURES',
        'AUTHENTICATED_SIGNING_TIME_REQUIRED',
      );
    if (
      !key.allowedCategories.includes(category) ||
      (criterion !== null && !key.allowedCriteria.includes(criterion))
    )
      codes.push('KEY_PERMISSION_DENIED');
  }
  if (state.snapshot.revokedDocumentIds.includes(subjectId))
    codes.push('DOCUMENT_REVOKED');
  return { codes, key };
}
export interface MultiKeyTestContext {
  readonly scope: 'TEST_ONLY';
  readonly domainId: string;
  readonly rootPublicKey: KeyObject;
  readonly rootReference: string;
  readonly clock: ClockProvider;
  readonly checkpointStore: TrustedRegistryCheckpointStore;
  readonly requireDurableCheckpoint: boolean;
}
export function createTestOnlyMultiKeyVerifier(context: MultiKeyTestContext) {
  const owner = Object.freeze({}),
    domainId = context.domainId,
    rootKey = context.rootPublicKey,
    rootReference = context.rootReference,
    store = context.checkpointStore,
    read = context.clock.read.bind(context.clock),
    testScope = context.scope,
    requireDurable = context.requireDurableCheckpoint;
  return Object.freeze({
    loadRegistry(input: unknown): MultiKeyObservation<RegistryIdentity> {
      let reading: unknown;
      try {
        reading = read();
        requireValue(
          testScope === 'TEST_ONLY' &&
            isNonEmptyString(domainId) &&
            isNonEmptyString(rootReference),
          'TEST_CONTEXT_REQUIRED',
        );
        requireValue(
          rootKey instanceof KeyObject &&
            rootKey.type === 'public' &&
            rootKey.asymmetricKeyType === 'ed25519',
          'TEST_ROOT_INVALID',
        );
        requireValue(
          !requireDurable && store.durability === 'PROCESS_ONLY',
          'TRUSTED_DURABLE_STATE_UNAVAILABLE',
        );
        const clock = inspectClock(reading);
        requireValue(
          clock?.kind === 'TEST_ONLY' && clock.timestamp,
          'TEST_CLOCK_REQUIRED',
        );
        requireValue(
          monotonicTime(owner, reading).length === 0,
          'CLOCK_ROLLBACK',
        );
        const i = obj(input);
        requireValue(
          Object.keys(i).every((k) => ['bytes', 'signatureBase64'].includes(k)),
          'PAYLOAD_TRUST_ANCHOR_REJECTED',
        );
        requireValue(
          i.bytes instanceof Uint8Array && i.bytes.length <= 4 * 1024 * 1024,
          'REGISTRY_BYTES_MISSING_OR_TOO_LARGE',
        );
        const bytes = Buffer.from(i.bytes),
          signature = strictBase64(i.signatureBase64);
        requireValue(
          signature?.length === 64 && verify(null, bytes, rootKey, signature),
          'REGISTRY_SIGNATURE_INVALID',
        );
        const snapshot = parseSnapshot(parseJsonBytes(bytes, true)),
          digest = rawSha256(bytes);
        const now = Date.parse(clock.timestamp);
        requireValue(
          now >= Date.parse(snapshot.effectiveAt) &&
            now <= Date.parse(snapshot.expiresAt),
          'REGISTRY_OUTSIDE_EFFECTIVE_PERIOD',
        );
        requireValue(
          now >= Date.parse(snapshot.createdAt) &&
            now - Date.parse(snapshot.revocationCheckedAt) >= 0 &&
            now - Date.parse(snapshot.revocationCheckedAt) <= 3600000,
          'REVOCATION_SNAPSHOT_STALE',
        );
        const rootIdentity = rawSha256(
            rootKey.export({ type: 'spki', format: 'der' }),
          ),
          scopeKey = canonicalJson([
            domainId,
            rootIdentity,
            snapshot.registryId,
          ]);
        const head = store.read(scopeKey);
        requireValue(
          head.status === 'FOUND' || head.status === 'EMPTY',
          'TRUSTED_CHECKPOINT_UNAVAILABLE',
        );
        const previous = head.status === 'FOUND' ? head.checkpoint : null;
        if (previous) {
          requireValue(
            snapshot.snapshotVersion >= previous.snapshotVersion,
            'REGISTRY_SNAPSHOT_ROLLBACK',
          );
          if (snapshot.snapshotVersion === previous.snapshotVersion)
            requireValue(
              digest === previous.sha256,
              'REGISTRY_SNAPSHOT_EQUIVOCATION',
            );
          else {
            requireValue(
              snapshot.snapshotVersion === previous.snapshotVersion + 1 &&
                snapshot.previousSnapshotSha256 === previous.sha256,
              'REGISTRY_PREVIOUS_SNAPSHOT_MISMATCH',
            );
            requireValue(
              Date.parse(snapshot.createdAt) >=
                Date.parse(previous.createdAt) &&
                snapshot.snapshotId !== previous.snapshotId,
              'REGISTRY_SNAPSHOT_TIME_OR_ID_ROLLBACK',
            );
          }
        } else
          requireValue(
            snapshot.snapshotVersion === 1 &&
              snapshot.previousSnapshotSha256 === null,
            'TRUSTED_BOOTSTRAP_CHECKPOINT_REQUIRED',
          );
        requireValue(
          (previous?.revokedDocumentIds ?? []).every((id) =>
            snapshot.revokedDocumentIds.includes(id),
          ),
          'DOCUMENT_REVOCATION_ROLLBACK',
        );
        const bindings = previous ? [...previous.keyBindings] : [];
        const revokedKeyIds = new Set(previous?.revokedKeyIds ?? []),
          revokedAuthorityIds = new Set(previous?.revokedAuthorityIds ?? []);
        const authorityEvents = [...(previous?.authorityEvents ?? [])];
        for (const authority of snapshot.authorities) {
          const oldEvent = authorityEvents.find(
            (a) => a.authorityId === authority.authorityId,
          );
          requireValue(
            !oldEvent ||
              oldEvent.revokedAt === null ||
              (authority.revokedAt !== null &&
                Date.parse(authority.revokedAt) <=
                  Date.parse(oldEvent.revokedAt)),
            'AUTHORITY_REVOCATION_EVENT_ROLLBACK',
          );
          const event = {
            authorityId: authority.authorityId,
            revokedAt: authority.revokedAt,
          };
          if (!oldEvent) authorityEvents.push(event);
          else authorityEvents[authorityEvents.indexOf(oldEvent)] = event;
          requireValue(
            !revokedAuthorityIds.has(authority.authorityId) ||
              authority.authorityStatus === 'REVOKED',
            'AUTHORITY_REVOCATION_ROLLBACK',
          );
          if (
            authority.authorityStatus === 'REVOKED' ||
            (authority.revokedAt && now >= Date.parse(authority.revokedAt))
          )
            revokedAuthorityIds.add(authority.authorityId);
        }
        for (const authority of snapshot.authorities)
          for (const key of authority.keys) {
            const prior = bindings.find((b) => b.keyId === key.keyId);
            requireValue(
              !prior ||
                (prior.authorityId === authority.authorityId &&
                  prior.fingerprint === key.publicKeySha256),
              'KEY_ID_REUSE_OR_SUBSTITUTION',
            );
            requireValue(
              !bindings.some(
                (b) =>
                  b.fingerprint === key.publicKeySha256 &&
                  b.keyId !== key.keyId,
              ),
              'HISTORICAL_SIGNING_IDENTITY_ALIAS_REJECTED',
            );
            if (prior) {
              requireValue(
                prior.keyVersion === key.keyVersion &&
                  prior.activatedAt === key.activatedAt &&
                  Date.parse(key.signingUntil) <=
                    Date.parse(prior.signingUntil),
                'KEY_LIFECYCLE_REWRITE_REJECTED',
              );
              requireValue(
                prior.revokedAt === null ||
                  (key.revokedAt !== null &&
                    Date.parse(key.revokedAt) <= Date.parse(prior.revokedAt)),
                'KEY_REVOCATION_EVENT_ROLLBACK',
              );
            }
            requireValue(
              !revokedKeyIds.has(key.keyId) || key.keyStatus === 'REVOKED',
              'KEY_REVOCATION_ROLLBACK',
            );
            if (
              key.keyStatus === 'REVOKED' ||
              (key.revokedAt && now >= Date.parse(key.revokedAt))
            )
              revokedKeyIds.add(key.keyId);
            const binding = {
              keyId: key.keyId,
              authorityId: authority.authorityId,
              fingerprint: key.publicKeySha256,
              keyVersion: key.keyVersion,
              activatedAt: key.activatedAt,
              signingUntil: key.signingUntil,
              revokedAt: key.revokedAt,
            };
            if (!prior) bindings.push(binding);
            else bindings[bindings.indexOf(prior)] = binding;
          }
        const next: RegistryCheckpoint = {
          snapshotVersion: snapshot.snapshotVersion,
          sha256: digest,
          snapshotId: snapshot.snapshotId,
          createdAt: snapshot.createdAt,
          keyBindings: bindings,
          authorityEvents,
          revokedDocumentIds: [
            ...new Set([
              ...(previous?.revokedDocumentIds ?? []),
              ...snapshot.revokedDocumentIds,
            ]),
          ].sort(),
          revokedKeyIds: [...revokedKeyIds].sort(),
          revokedAuthorityIds: [...revokedAuthorityIds].sort(),
        };
        requireValue(
          store.compareAndAdvance(
            scopeKey,
            previous?.sha256 ?? null,
            immutableJson(next),
          ) === 'COMMITTED',
          'CHECKPOINT_ATOMIC_ADVANCE_FAILED',
        );
        const committed = store.read(scopeKey);
        requireValue(
          committed.status === 'FOUND' &&
            committed.checkpoint.sha256 === digest &&
            committed.checkpoint.snapshotVersion === snapshot.snapshotVersion &&
            canonicalJson(committed.checkpoint) === canonicalJson(next),
          'CHECKPOINT_COMMIT_NOT_OBSERVED',
        );
        const identity: RegistryIdentity = {
          registryId: snapshot.registryId,
          snapshotId: snapshot.snapshotId,
          snapshotVersion: snapshot.snapshotVersion,
          sha256: digest,
          checkpointDurability: store.durability,
        };
        const result = observation(
          'VERIFIED_TEST_ONLY',
          [
            'NATIVE_SIGNED_V3_REGISTRY',
            store.durability === 'PROCESS_ONLY'
              ? 'ROLLBACK_PROTECTION_PROCESS_ONLY'
              : 'EXTERNAL_CHECKPOINT_CONTRACT',
          ],
          reading,
          snapshot.registryId,
          rootReference,
          identity,
        );
        registryReceipts.set(result, {
          owner,
          snapshot,
          identity: immutableJson(identity),
          scopeKey,
          store,
        });
        return result;
      } catch (err: unknown) {
        return observation(
          'REJECTED',
          [
            err instanceof ContractError
              ? err.message
              : 'REGISTRY_CRYPTO_PARSE_OR_CHECKPOINT_ERROR',
          ],
          reading,
          'registry',
          null,
        );
      }
    },
    verifyDocument(
      input: unknown,
      registry: unknown,
    ): MultiKeyObservation<MultiKeyDocumentIdentity> {
      let reading: unknown;
      try {
        reading = read();
        const state =
          registry !== null && typeof registry === 'object'
            ? registryReceipts.get(registry)
            : undefined;
        requireValue(
          state && state.owner === owner,
          'REGISTRY_RECEIPT_FORGED_OR_CROSS_DOMAIN',
        );
        const i = obj(input);
        requireValue(
          Object.keys(i).every((k) =>
            [
              'bytes',
              'signatureBase64',
              'algorithm',
              'keyId',
              'authorityId',
            ].includes(k),
          ),
          'PAYLOAD_KEY_OR_SIGNING_TIME_CREDENTIAL_REJECTED',
        );
        requireValue(
          i.algorithm === 'Ed25519' &&
            i.bytes instanceof Uint8Array &&
            i.bytes.length <= 4 * 1024 * 1024,
          'DOCUMENT_BYTES_OR_ALGORITHM_INVALID',
        );
        const bytes = Buffer.from(i.bytes),
          raw = obj(parseJsonBytes(bytes, true));
        requireValue(
          raw.schema === 'qualification-multikey-document-v1',
          'DOCUMENT_SCHEMA_UNSUPPORTED',
        );
        const category = pick(
          raw.category,
          MULTIKEY_CATEGORIES,
          'DOCUMENT_CATEGORY_INVALID',
        );
        const criterion =
          raw.criterion === null
            ? null
            : pick(
                raw.criterion,
                ALL_QUALIFICATION_CRITERIA,
                'DOCUMENT_CRITERION_INVALID',
              );
        requireValue(
          ![
            'LEGAL_PROOF',
            'STRUCTURE_PROOF',
            'SURVEY_PROOF',
            'EVIDENCE',
            'EXEMPTION',
          ].includes(category) || criterion !== null,
          'DOCUMENT_CRITERION_REQUIRED',
        );
        requireValue(
          !['GRAPH_MANIFEST', 'PROFILE_APPROVAL'].includes(category) ||
            criterion === null,
          'NONCRITERION_DOCUMENT_REQUIRES_NULL',
        );
        const subjectId = str(raw.subjectId, 'DOCUMENT_SUBJECT_REQUIRED'),
          authorityId = str(i.authorityId, 'AUTHORITY_ID_REQUIRED'),
          keyId = str(i.keyId, 'KEY_ID_REQUIRED');
        requireValue(
          raw.authorityId === authorityId && raw.keyId === keyId,
          'DOCUMENT_SIGNER_IDENTITY_MISMATCH',
        );
        const eligibility = authorize(
          state,
          reading,
          authorityId,
          keyId,
          category,
          criterion,
          subjectId,
        );
        if (eligibility.codes.length)
          return observation(
            'REJECTED',
            eligibility.codes,
            reading,
            subjectId,
            state.identity.sha256,
          );
        requireValue(
          raw.registryId === state.snapshot.registryId &&
            raw.snapshotId === state.snapshot.snapshotId,
          'DOCUMENT_REGISTRY_SNAPSHOT_MISMATCH',
        );
        requireValue(eligibility.key, 'KEY_NOT_REGISTERED');
        const signature = strictBase64(i.signatureBase64);
        requireValue(
          signature?.length === 64 &&
            verify(
              null,
              bytes,
              createPublicKey(eligibility.key.publicKeyPem),
              signature,
            ),
          'DOCUMENT_SIGNATURE_INVALID',
        );
        const validFrom = utc(raw.validFrom),
          validUntil = utc(raw.validUntil);
        interval(validFrom, validUntil);
        const clock = inspectClock(reading);
        requireValue(clock?.timestamp, 'TEST_CLOCK_REQUIRED');
        requireValue(
          Date.parse(clock.timestamp) >= Date.parse(validFrom) &&
            Date.parse(clock.timestamp) <= Date.parse(validUntil),
          'DOCUMENT_OUTSIDE_VALIDITY',
        );
        const claimedSigningTime =
          raw.claimedSigningTime === null ? null : utc(raw.claimedSigningTime);
        if (claimedSigningTime)
          requireValue(
            Date.parse(claimedSigningTime) >=
              Date.parse(eligibility.key.activatedAt) &&
              Date.parse(claimedSigningTime) <=
                Date.parse(eligibility.key.signingUntil) &&
              Date.parse(claimedSigningTime) <= Date.parse(clock.timestamp),
            'CLAIMED_SIGNING_TIME_INVALID',
          );
        const envelope: MultiKeyEnvelope = {
          registryId: state.snapshot.registryId,
          snapshotId: state.snapshot.snapshotId,
          schema: 'qualification-multikey-document-v1',
          subjectId,
          authorityId,
          keyId,
          category,
          criterion,
          validFrom,
          validUntil,
          claimedSigningTime,
          body: obj(raw.body),
        };
        const identity = immutableJson({
          envelope,
          documentSha256: rawSha256(bytes),
          keyFingerprint: eligibility.key.publicKeySha256,
          registry: state.identity,
          signingTime: 'UNAUTHENTICATED' as const,
        });
        const result = observation(
          'VERIFIED_TEST_ONLY',
          [
            'NATIVE_DOCUMENT_SIGNATURE',
            'SIGNING_TIME_NOT_AUTHENTICATED',
            'NO_PRODUCTION_AUTHORITY',
          ],
          reading,
          subjectId,
          state.identity.sha256,
          identity,
        );
        documentReceipts.set(result, { registry, owner, identity });
        return result;
      } catch (err: unknown) {
        return observation(
          'REJECTED',
          [
            err instanceof ContractError
              ? err.message
              : 'DOCUMENT_CRYPTO_PARSE_ERROR',
          ],
          reading,
          'document',
          null,
        );
      }
    },
  });
}
/** No caller-supplied verifier callback can manufacture either provenance map. */
export function revalidateMultiKeyDocument(
  receipt: unknown,
  expectedRegistry: unknown,
  reading: unknown,
): MultiKeyObservation<MultiKeyDocumentIdentity> {
  const doc =
    receipt !== null && typeof receipt === 'object'
      ? documentReceipts.get(receipt)
      : undefined;
  const state =
    expectedRegistry !== null && typeof expectedRegistry === 'object'
      ? registryReceipts.get(expectedRegistry)
      : undefined;
  const previousFailure =
    receipt !== null && typeof receipt === 'object'
      ? issuedFailureCodes.get(receipt)
      : undefined;
  if (!doc && state && previousFailure)
    return observation(
      'REJECTED',
      [...previousFailure, 'DOCUMENT_VERIFICATION_PREVIOUSLY_FAILED'],
      reading,
      'document',
      state.identity.sha256,
    );
  if (
    !doc ||
    !state ||
    doc.registry !== expectedRegistry ||
    doc.owner !== state.owner
  )
    return observation(
      'REJECTED',
      ['DOCUMENT_RECEIPT_FORGED_OR_CROSS_REGISTRY'],
      reading,
      'document',
      null,
    );
  const e = doc.identity.envelope,
    eligibility = authorize(
      state,
      reading,
      e.authorityId,
      e.keyId,
      e.category,
      e.criterion,
      e.subjectId,
    ),
    clock = inspectClock(reading);
  if (
    clock?.timestamp &&
    (Date.parse(clock.timestamp) < Date.parse(e.validFrom) ||
      Date.parse(clock.timestamp) > Date.parse(e.validUntil))
  )
    eligibility.codes.push('DOCUMENT_OUTSIDE_VALIDITY');
  return eligibility.codes.length
    ? observation(
        'REJECTED',
        eligibility.codes,
        reading,
        e.subjectId,
        state.identity.sha256,
      )
    : observation(
        'VERIFIED_TEST_ONLY',
        ['DOCUMENT_REVALIDATED_TEST_ONLY'],
        reading,
        e.subjectId,
        state.identity.sha256,
        doc.identity,
      );
}
