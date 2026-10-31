#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/316be7b97517ab08245be5e1aa9a24270aeee914d896b08d33f52622bfe2f33d/contract';
import startContract from '../../snapshots/316be7b97517ab08245be5e1aa9a24270aeee914d896b08d33f52622bfe2f33d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/410ff39d0ae2b343812169ae9fea0b22a891bbd65a1f0fe3b7c381d880d9c8bc/contract';
import endContract from '../../snapshots/410ff39d0ae2b343812169ae9fea0b22a891bbd65a1f0fe3b7c381d880d9c8bc/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'rescueRequest',
        column: col('sosEventId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'rescueRequest',
        constraint: 'rescueRequest_sosEventId_key',
        columns: ['sosEventId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueRequest',
        foreignKey: {
          name: 'rescueRequest_sosEventId_fkey',
          columns: ['sosEventId'],
          references: { schema: 'public', table: 'sOSEvent', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
