#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/145858b7cfd53d3150047325a0a74e09ae79fab8f6e1bccd449824b0ccf74dab/contract';
import startContract from '../../snapshots/145858b7cfd53d3150047325a0a74e09ae79fab8f6e1bccd449824b0ccf74dab/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bb5100a6157dbb80c0df27b82f513e1c3022b61cbfdbfebc786362e717e1ed7c/contract';
import endContract from '../../snapshots/bb5100a6157dbb80c0df27b82f513e1c3022b61cbfdbfebc786362e717e1ed7c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('photoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
