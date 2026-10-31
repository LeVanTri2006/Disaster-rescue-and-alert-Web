#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/04e71a349eacbbddce6ac55f04ecfedf22643bfc1654eab01343eb7402461a2f/contract';
import startContract from '../../snapshots/04e71a349eacbbddce6ac55f04ecfedf22643bfc1654eab01343eb7402461a2f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/145858b7cfd53d3150047325a0a74e09ae79fab8f6e1bccd449824b0ccf74dab/contract';
import endContract from '../../snapshots/145858b7cfd53d3150047325a0a74e09ae79fab8f6e1bccd449824b0ccf74dab/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('resetPasswordExpiresAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('resetPasswordOtp', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
