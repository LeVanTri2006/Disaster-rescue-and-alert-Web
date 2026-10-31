#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/04e71a349eacbbddce6ac55f04ecfedf22643bfc1654eab01343eb7402461a2f/contract';
import endContract from '../../snapshots/04e71a349eacbbddce6ac55f04ecfedf22643bfc1654eab01343eb7402461a2f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/803e5ae7eba7ee33b4d718d3b733fc2731754c450d9cfec2c9f9140adb078001/contract';
import startContract from '../../snapshots/803e5ae7eba7ee33b4d718d3b733fc2731754c450d9cfec2c9f9140adb078001/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('firebaseUid', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_firebaseUid_key',
        columns: ['firebaseUid'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
