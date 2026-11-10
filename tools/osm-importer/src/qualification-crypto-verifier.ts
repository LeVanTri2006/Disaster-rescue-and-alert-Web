import { createPublicKey, KeyObject, verify } from 'node:crypto';
import {
  ALL_QUALIFICATION_CRITERIA,
  QualificationCriterion,
} from './qualification-types';
import {
  isNonEmptyString,
  isObject,
  isValidIsoTimestamp,
} from './qualification-validation';
import { authorizeTestAuthority } from './qualification-authority-registry';
import {
  DocumentCategory,
  failure,
  metadata,
  VerificationResult,
  VERIFICATION_POLICY_VERSION,
} from './qualification-trust-types';
import {
  canonicalJson,
  immutableJson,
  parseJsonBytes,
  rawSha256,
  strictBase64,
} from './qualification-verification-json';
import { inspectClock, verifyValidity } from './qualification-trusted-clock';

export interface SignedEnvelope {
  readonly schema: 'qualification-signed-document-v1';
  readonly subjectId: string;
  readonly authorityId: string;
  readonly category: DocumentCategory;
  readonly criterion: QualificationCriterion | null;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly body: Readonly<Record<string, unknown>>;
}
export interface SignatureDetails {
  readonly documentSha256: string;
  readonly keyFingerprint: string;
  readonly signatureMathematicallyValid: true;
}
export interface DocumentDetails extends SignatureDetails {
  readonly keyId: string;
  readonly envelope: SignedEnvelope;
}
interface Receipt {
  readonly details: DocumentDetails;
  readonly registry: unknown;
  readonly keyId: string;
  readonly policyVersion: typeof VERIFICATION_POLICY_VERSION;
}
const documents = new WeakMap<object, Receipt>();

/** Ed25519 detached signature over EXACT supplied bytes, 64 signature bytes,
 * canonical padded base64. Caller key is allowed ONLY for mathematics: no issuer
 * authentication is claimed or cached by this primitive.
 */
export function verifySignatureMathematics(
  bytes: unknown,
  signatureBase64: unknown,
  algorithm: unknown,
  key: unknown,
  reading: unknown,
): VerificationResult<SignatureDetails> {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'SIGNATURE_MATHEMATICS',
        'raw-document',
        clock?.timestamp ?? null,
        'CALLER_KEY_MATHEMATICS_ONLY',
        'TECHNICAL_ONLY',
      ),
      method: 'NODE_CRYPTO_ED25519_RAW_BYTES',
    };
  try {
    if (!clock?.timestamp)
      return failure(meta, 'VERIFIER_UNAVAILABLE', [
        'CLOCK_UNAVAILABLE_OR_FORGED',
      ]);
    if (algorithm !== 'Ed25519')
      return failure(meta, 'INVALID', ['ALGORITHM_NOT_ALLOWED']);
    if (!(bytes instanceof Uint8Array))
      return failure(meta, 'UNVERIFIED', ['DOCUMENT_BYTES_MISSING']);
    if (
      !(key instanceof KeyObject) ||
      key.type !== 'public' ||
      key.asymmetricKeyType !== 'ed25519'
    )
      return failure(meta, 'INVALID', ['PUBLIC_ED25519_KEY_REQUIRED']);
    const signature = strictBase64(signatureBase64);
    if (!signature || signature.length !== 64)
      return failure(meta, 'INVALID', ['SIGNATURE_ENCODING_INVALID']);
    const copy = Buffer.from(bytes);
    if (!verify(null, copy, key, signature))
      return failure(meta, 'INVALID', ['SIGNATURE_INVALID']);
    const details = Object.freeze({
      documentSha256: rawSha256(copy),
      keyFingerprint: rawSha256(key.export({ type: 'spki', format: 'der' })),
      signatureMathematicallyValid: true as const,
    });
    return Object.freeze({
      ...meta,
      artifactIdentity: Object.freeze({ sha256: details.documentSha256 }),
      status: 'VERIFIED',
      scope: 'TECHNICAL_ONLY',
      verificationTimestamp: clock.timestamp,
      trustSourceReference: 'CALLER_KEY_MATHEMATICS_ONLY',
      assurance: 'SIGNATURE_MATHEMATICS',
      details,
      diagnosticCodes: Object.freeze([
        'ISSUER_NOT_AUTHENTICATED',
        'QUALIFICATION_NOT_AUTHORIZED',
      ]),
    });
  } catch {
    return failure(meta, 'INVALID', ['SIGNATURE_CRYPTO_ERROR']);
  }
}
export interface DetachedDocumentInput {
  readonly bytes?: Uint8Array;
  readonly signatureBase64?: string;
  readonly algorithm: string;
  readonly keyId: string;
  readonly authorityId: string;
  readonly subjectId: string;
  readonly category: DocumentCategory;
  readonly criterion: QualificationCriterion | null;
}
export function verifySignedDocument(
  input: DetachedDocumentInput,
  registry: unknown,
  reading: unknown,
): VerificationResult<DocumentDetails> {
  const clock = inspectClock(reading),
    meta = {
      ...metadata(
        'DOCUMENT_AUTHENTICITY',
        isObject(input) && typeof input.subjectId === 'string'
          ? input.subjectId
          : 'UNKNOWN_SUBJECT',
        clock?.timestamp ?? null,
        null,
        'TEST_ONLY',
      ),
      method: 'ED25519_AND_SIGNED_TEST_REGISTRY',
      keyId:
        isObject(input) && typeof input.keyId === 'string'
          ? input.keyId
          : undefined,
    };
  try {
    if (!isObject(input))
      return failure(meta, 'INVALID', ['DOCUMENT_REQUEST_INVALID']);
    // A payload key or chain must never override out-of-band registry selection.
    if ('publicKey' in input || 'certificateChain' in input)
      return failure(meta, 'UNTRUSTED_ISSUER', [
        'PAYLOAD_TRUST_ANCHOR_REJECTED',
      ]);
    if (input.algorithm !== 'Ed25519')
      return failure(meta, 'INVALID', ['ALGORITHM_NOT_ALLOWED']);
    if (!(input.bytes instanceof Uint8Array))
      return failure(meta, 'UNVERIFIED', ['DOCUMENT_BYTES_MISSING']);
    const auth = authorizeTestAuthority(
      registry,
      reading,
      input.authorityId,
      input.keyId,
      input.category,
      input.criterion,
      input.subjectId,
    );
    if (auth.status !== 'VERIFIED')
      return failure(meta, auth.status, auth.diagnosticCodes);
    const bytes = Buffer.from(input.bytes),
      math = verifySignatureMathematics(
        bytes,
        input.signatureBase64,
        input.algorithm,
        createPublicKey(auth.details.publicKeyPem),
        reading,
      );
    if (math.status !== 'VERIFIED')
      return failure(meta, math.status, math.diagnosticCodes);
    const raw = parseJsonBytes(bytes, true);
    if (
      !isObject(raw) ||
      raw.schema !== 'qualification-signed-document-v1' ||
      !isNonEmptyString(raw.subjectId) ||
      !isNonEmptyString(raw.authorityId) ||
      !isObject(raw.body) ||
      !['GRAPH_MANIFEST', 'EVIDENCE', 'EXEMPTION', 'PROFILE_APPROVAL'].includes(
        String(raw.category),
      ) ||
      !(
        raw.criterion === null ||
        ALL_QUALIFICATION_CRITERIA.some((c) => c === raw.criterion)
      ) ||
      !isValidIsoTimestamp(raw.validFrom) ||
      !isValidIsoTimestamp(raw.validUntil)
    )
      return failure(meta, 'INVALID', ['SIGNED_ENVELOPE_SCHEMA_INVALID']);
    if (
      raw.subjectId !== input.subjectId ||
      raw.authorityId !== input.authorityId ||
      raw.category !== input.category ||
      raw.criterion !== input.criterion
    )
      return failure(meta, 'INVALID', ['SIGNED_ENVELOPE_IDENTITY_MISMATCH']);
    if (
      (raw.category === 'EVIDENCE' || raw.category === 'EXEMPTION') &&
      raw.criterion === null
    )
      return failure(meta, 'INVALID', ['SIGNED_CRITERION_REQUIRED']);
    if (
      (raw.category === 'GRAPH_MANIFEST' ||
        raw.category === 'PROFILE_APPROVAL') &&
      raw.criterion !== null
    )
      return failure(meta, 'INVALID', [
        'NON_CRITERION_DOCUMENT_REQUIRES_NULL_CRITERION',
      ]);
    const window = verifyValidity(
      {
        validFrom: raw.validFrom,
        validUntil: raw.validUntil,
        revocationStatus: 'ACTIVE',
      },
      reading,
    );
    if (window.status !== 'VERIFIED')
      return failure(meta, window.status, window.diagnosticCodes);
    const details = immutableJson({
      ...math.details,
      keyId: input.keyId,
      envelope: raw as unknown as SignedEnvelope,
    });
    const result: VerificationResult<DocumentDetails> = Object.freeze({
      ...meta,
      artifactIdentity: Object.freeze({ sha256: math.details.documentSha256 }),
      status: 'VERIFIED',
      scope: 'TEST_ONLY',
      verificationTimestamp: clock!.timestamp!,
      trustSourceReference: auth.trustSourceReference,
      assurance: 'TEST_DOCUMENT_AUTHENTICITY',
      details,
      diagnosticCodes: Object.freeze([
        'TEST_ISSUER_ONLY',
        'NO_PRODUCTION_PKI',
        'X509_CHAIN_NOT_VERIFIED',
      ]),
    });
    documents.set(result, {
      details,
      registry,
      keyId: input.keyId,
      policyVersion: VERIFICATION_POLICY_VERSION,
    });
    return result;
  } catch {
    return failure(meta, 'INVALID', ['DOCUMENT_PARSE_OR_VERIFICATION_ERROR']);
  }
}
/** Runtime receipt provenance, freshness and revocation rechecked on every use.
 * JSON copies, spreads, casts and caller-created VERIFIED objects are rejected.
 */
export function inspectVerifiedDocument(
  result: unknown,
  category: DocumentCategory,
  reading: unknown,
  expectedRegistry?: unknown,
): DocumentDetails | undefined {
  const receipt =
    result !== null && typeof result === 'object'
      ? documents.get(result)
      : undefined;
  if (
    !receipt ||
    receipt.policyVersion !== VERIFICATION_POLICY_VERSION ||
    (expectedRegistry !== undefined && expectedRegistry !== receipt.registry) ||
    receipt.details.envelope.category !== category
  )
    return undefined;
  const e = receipt.details.envelope,
    auth = authorizeTestAuthority(
      receipt.registry,
      reading,
      e.authorityId,
      receipt.keyId,
      e.category,
      e.criterion,
      e.subjectId,
    );
  const window = verifyValidity(
    {
      validFrom: e.validFrom,
      validUntil: e.validUntil,
      revocationStatus: 'ACTIVE',
    },
    reading,
  );
  return auth.status === 'VERIFIED' && window.status === 'VERIFIED'
    ? receipt.details
    : undefined;
}
