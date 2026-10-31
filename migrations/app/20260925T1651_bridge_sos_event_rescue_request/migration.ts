#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/410ff39d0ae2b343812169ae9fea0b22a891bbd65a1f0fe3b7c381d880d9c8bc/contract';
import endContract from '../../snapshots/410ff39d0ae2b343812169ae9fea0b22a891bbd65a1f0fe3b7c381d880d9c8bc/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract';
import startContract from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

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
      this.createTable({
        schema: 'public',
        table: 'spatialIndexMigration',
        columns: [col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } })],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'rescueRequest',
        column: col('sosEventId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
        column: col('photoUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
      this.addUnique({
        schema: 'public',
        table: 'rescueRequest',
        constraint: 'rescueRequest_sosEventId_key',
        columns: ['sosEventId'],
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
      this.createIndex({
        schema: 'public',
        table: 'sOSPhoto',
        index: 'sOSPhoto_sosEventId_idx_ca7a2959',
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
