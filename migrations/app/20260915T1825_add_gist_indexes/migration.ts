#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2efa1e8f41172b0d9b313279eab51ea95595b7fdb30ce11dac98f826e30449b6/contract';
import endContract from '../../snapshots/2efa1e8f41172b0d9b313279eab51ea95595b7fdb30ce11dac98f826e30449b6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract';
import startContract from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

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
      rawSql({
        id: 'index.disasterArea.disasterArea_area_gist_idx',
        label: 'Create index "disasterArea_area_gist_idx" on "disasterArea"',
        operationClass: 'additive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'index', name: 'disasterArea_area_gist_idx' } },
        precheck: [],
        execute: [{ description: 'Create GiST index for area', sql: 'CREATE INDEX "disasterArea_area_gist_idx" ON "public"."disasterArea" USING GIST ("area");' }],
        postcheck: []
      }),
      rawSql({
        id: 'index.location.location_point_gist_idx',
        label: 'Create index "location_point_gist_idx" on "location"',
        operationClass: 'additive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'index', name: 'location_point_gist_idx' } },
        precheck: [],
        execute: [{ description: 'Create GiST index for point', sql: 'CREATE INDEX "location_point_gist_idx" ON "public"."location" USING GIST ("point");' }],
        postcheck: []
      }),
      rawSql({
        id: 'index.rescueRequest.rescueRequest_location_gist_idx',
        label: 'Create index "rescueRequest_location_gist_idx" on "rescueRequest"',
        operationClass: 'additive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'index', name: 'rescueRequest_location_gist_idx' } },
        precheck: [],
        execute: [{ description: 'Create GiST index for location', sql: 'CREATE INDEX "rescueRequest_location_gist_idx" ON "public"."rescueRequest" USING GIST ("location");' }],
        postcheck: []
      }),
      rawSql({
        id: 'index.sOSEvent.sOSEvent_location_gist_idx',
        label: 'Create index "sOSEvent_location_gist_idx" on "sOSEvent"',
        operationClass: 'additive',
        target: { id: 'postgres', details: { schema: 'public', objectType: 'index', name: 'sOSEvent_location_gist_idx' } },
        precheck: [],
        execute: [{ description: 'Create GiST index for location', sql: 'CREATE INDEX "sOSEvent_location_gist_idx" ON "public"."sOSEvent" USING GIST ("location");' }],
        postcheck: []
      })
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
