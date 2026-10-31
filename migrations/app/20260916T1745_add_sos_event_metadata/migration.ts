#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2efa1e8f41172b0d9b313279eab51ea95595b7fdb30ce11dac98f826e30449b6/contract';
import startContract from '../../snapshots/2efa1e8f41172b0d9b313279eab51ea95595b7fdb30ce11dac98f826e30449b6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/803e5ae7eba7ee33b4d718d3b733fc2731754c450d9cfec2c9f9140adb078001/contract';
import endContract from '../../snapshots/803e5ae7eba7ee33b4d718d3b733fc2731754c450d9cfec2c9f9140adb078001/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('accuracyMeters', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('adults', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('batteryPercent', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('children', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('elderly', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('neededItems', 'text[]', {
          notNull: true,
          default: lit([]),
          codecRef: { codecId: 'pg/text@1', many: true },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('transportMode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sOSEvent',
        column: col('urgency', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'sOSEvent',
        constraint: 'sOSEvent_neededItems_elem_not_null_b53aad55',
        expression: 'array_position("neededItems", NULL) IS NULL',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'sOSEvent',
        constraint: 'sOSEvent_urgency_check_a1ef6707',
        expression: "\"urgency\" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'sOSEvent',
        index: 'sOSEvent_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
