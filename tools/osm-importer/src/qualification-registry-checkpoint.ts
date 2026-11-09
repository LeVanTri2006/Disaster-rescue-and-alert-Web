import { immutableJson } from './qualification-verification-json';
export interface RegistryCheckpoint {
  readonly snapshotVersion: number;
  readonly sha256: string;
  readonly snapshotId: string;
  readonly createdAt: string;
  readonly keyBindings: readonly {
    readonly keyId: string;
    readonly authorityId: string;
    readonly fingerprint: string;
    readonly keyVersion: number;
    readonly activatedAt: string;
    readonly signingUntil: string;
    readonly revokedAt: string | null;
  }[];
  readonly authorityEvents: readonly {
    readonly authorityId: string;
    readonly revokedAt: string | null;
  }[];
  readonly revokedDocumentIds: readonly string[];
  readonly revokedKeyIds: readonly string[];
  readonly revokedAuthorityIds: readonly string[];
}
export type CheckpointRead = Readonly<
  | { status: 'EMPTY' }
  | { status: 'FOUND'; checkpoint: RegistryCheckpoint }
  | { status: 'UNAVAILABLE' }
>;
/** External implementations must atomically persist both high-water mark and
 * all historical key identities. No database/storage implementation is supplied. */
export interface TrustedRegistryCheckpointStore {
  readonly durability: 'PROCESS_ONLY' | 'EXTERNAL_DURABLE';
  read(scopeKey: string): CheckpointRead;
  compareAndAdvance(
    scopeKey: string,
    expectedSha256: string | null,
    next: RegistryCheckpoint,
  ): 'COMMITTED' | 'CONFLICT' | 'UNAVAILABLE';
}
/** Isolated TEST_ONLY fixture. State disappears on restart, deliberately. */
export function isolatedTestCheckpointStore(): TrustedRegistryCheckpointStore {
  const entries = new Map<string, RegistryCheckpoint>();
  return Object.freeze({
    durability: 'PROCESS_ONLY' as const,
    read(scopeKey: string): CheckpointRead {
      const checkpoint = entries.get(scopeKey);
      return checkpoint ? { status: 'FOUND', checkpoint } : { status: 'EMPTY' };
    },
    compareAndAdvance(
      scopeKey: string,
      expected: string | null,
      next: RegistryCheckpoint,
    ) {
      if ((entries.get(scopeKey)?.sha256 ?? null) !== expected)
        return 'CONFLICT' as const;
      entries.set(
        scopeKey,
        immutableJson({
          ...next,
          keyBindings: next.keyBindings.map((k) => ({ ...k })),
        }),
      );
      return 'COMMITTED' as const;
    },
  });
}
