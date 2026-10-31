#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2efa1e8f41172b0d9b313279eab51ea95595b7fdb30ce11dac98f826e30449b6/contract';
import endContract from '../../snapshots/2efa1e8f41172b0d9b313279eab51ea95595b7fdb30ce11dac98f826e30449b6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract';
import startContract from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'spatialIndexMigration',
        columns: [col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } })],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
