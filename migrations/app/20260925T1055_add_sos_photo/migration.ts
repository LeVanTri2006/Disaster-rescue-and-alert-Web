#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/316be7b97517ab08245be5e1aa9a24270aeee914d896b08d33f52622bfe2f33d/contract';
import endContract from '../../snapshots/316be7b97517ab08245be5e1aa9a24270aeee914d896b08d33f52622bfe2f33d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/bb5100a6157dbb80c0df27b82f513e1c3022b61cbfdbfebc786362e717e1ed7c/contract';
import startContract from '../../snapshots/bb5100a6157dbb80c0df27b82f513e1c3022b61cbfdbfebc786362e717e1ed7c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'sOSPhoto',
        columns: [
          col('contentType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('fileSize', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('objectKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sosEventId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sOSPhoto',
        index: 'sOSPhoto_sosEventId_idx_ca7a2959',
        columns: ['sosEventId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sOSPhoto',
        foreignKey: {
          name: 'sOSPhoto_sosEventId_fkey',
          columns: ['sosEventId'],
          references: { schema: 'public', table: 'sOSEvent', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
