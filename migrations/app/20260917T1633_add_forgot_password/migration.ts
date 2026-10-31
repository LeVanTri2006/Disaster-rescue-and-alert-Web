#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/145858b7cfd53d3150047325a0a74e09ae79fab8f6e1bccd449824b0ccf74dab/contract';
import endContract from '../../snapshots/145858b7cfd53d3150047325a0a74e09ae79fab8f6e1bccd449824b0ccf74dab/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract';
import startContract from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

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
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('firebaseUid', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
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
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_firebaseUid_key',
        columns: ['firebaseUid'],
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
