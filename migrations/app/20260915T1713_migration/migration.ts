#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/34e29970d89e59c2b885df9e37bac1cc7be21a89012f80021624f374871d3346/contract';
import startContract from '../../snapshots/34e29970d89e59c2b885df9e37bac1cc7be21a89012f80021624f374871d3346/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract';
import endContract from '../../snapshots/b7fda5fcedf2026f44a1060bb28baded9c2c94bfce5880103f488ae373d8516a/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'systemHealth' }),
      this.createTable({
        schema: 'public',
        table: 'conversation',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('missionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sosEventId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'conversation_type_check_7cad376a',
            "\"type\" IN ('DIRECT', 'MISSION', 'SOS_GROUP')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'conversationParticipant',
        columns: [
          col('conversationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'disaster',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('endTime', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startTime', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'disaster_severity_check_5e5a5e80',
            "\"severity\" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
          ),
          checkExpression(
            'disaster_status_check_1474f751',
            "\"status\" IN ('ACTIVE', 'RESOLVED', 'CLOSED')",
          ),
          checkExpression(
            'disaster_type_check_487a6659',
            "\"type\" IN ('STORM', 'FLOOD', 'EARTHQUAKE', 'LANDSLIDE', 'TSUNAMI', 'DROUGHT', 'WILDFIRE', 'OTHER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'disasterArea',
        columns: [
          col('area', 'geometry(Geometry,4326)', {
            notNull: true,
            codecRef: { codecId: 'pg/geometry@1', typeParams: { srid: 4326 } },
          }),
          col('disasterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('population', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'disasterArea_severity_check_5e5a5e80',
            "\"severity\" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'location',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('point', 'geometry(Geometry,4326)', {
            notNull: true,
            codecRef: { codecId: 'pg/geometry@1', typeParams: { srid: 4326 } },
          }),
          col('timestamp', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('type', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'message',
        columns: [
          col('conversationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('mediaUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('point', 'geometry(Geometry,4326)', {
            codecRef: { codecId: 'pg/geometry@1', typeParams: { srid: 4326 } },
          }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('senderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('text', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', {
            notNull: true,
            default: lit('TEXT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'message_type_check_4f6552e3',
            "\"type\" IN ('TEXT', 'LOCATION', 'IMAGE', 'SYSTEM')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'notification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('read', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('recipientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'notification_type_check_deef6564',
            "\"type\" IN ('WARNING', 'SOS', 'MISSION_UPDATE', 'SYSTEM')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'rescueMission',
        columns: [
          col('acceptedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('requestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rescuerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ASSIGNED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('teamId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'rescueMission_status_check_892ef73b',
            "\"status\" IN ('ASSIGNED', 'IN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'rescueProfile',
        columns: [
          col('availability', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('identification', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('skills', 'text[]', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('vehicle', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('verificationStatus', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'rescueProfile_skills_elem_not_null_79c19a4f',
            'array_position("skills", NULL) IS NULL',
          ),
          checkExpression(
            'rescueProfile_verificationStatus_check_5d9c5935',
            "\"verificationStatus\" IN ('PENDING', 'APPROVED', 'REJECTED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'rescueRequest',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('location', 'geometry(Geometry,4326)', {
            notNull: true,
            codecRef: { codecId: 'pg/geometry@1', typeParams: { srid: 4326 } },
          }),
          col('peopleCount', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('requesterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('urgency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'rescueRequest_status_check_7c3ed2a8',
            "\"status\" IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')",
          ),
          checkExpression(
            'rescueRequest_urgency_check_a1ef6707',
            "\"urgency\" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'rescueTeam',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leaderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'rescueTeam_status_check_b8ad1bc9',
            "\"status\" IN ('ACTIVE', 'INACTIVE', 'ON_MISSION')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'sOSEvent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('emergencyType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('location', 'geometry(Geometry,4326)', {
            notNull: true,
            codecRef: { codecId: 'pg/geometry@1', typeParams: { srid: 4326 } },
          }),
          col('message', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'sOSEvent_status_check_7faa7610',
            "\"status\" IN ('ACTIVE', 'RESOLVED', 'FALSE_ALARM')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'teamMember',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('role', 'text', {
            notNull: true,
            default: lit('MEMBER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('teamId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'teamMember_role_check_bcc5eb78',
            "\"role\" IN ('LEADER', 'COORDINATOR', 'SPECIALIST', 'MEMBER', 'VOLUNTEER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('avatar', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fullName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('USER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'user_role_check_168b6c6a',
            "\"role\" IN ('ADMIN', 'MODERATOR', 'USER', 'RESCUER')",
          ),
          checkExpression(
            'user_status_check_8fe65f21',
            "\"status\" IN ('ACTIVE', 'INACTIVE', 'BANNED', 'PENDING')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'warning',
        columns: [
          col('disasterId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('issuedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'warning_severity_check_5e5a5e80',
            "\"severity\" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'conversation',
        constraint: 'conversation_sosEventId_key',
        columns: ['sosEventId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'conversationParticipant',
        constraint: 'conversationParticipant_conversationId_userId_key',
        columns: ['conversationId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'rescueProfile',
        constraint: 'rescueProfile_userId_key',
        columns: ['userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'teamMember',
        constraint: 'teamMember_teamId_userId_key',
        columns: ['teamId', 'userId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_phone_key',
        columns: ['phone'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_missionId_idx_25ef2118',
        columns: ['missionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversation',
        index: 'conversation_sosEventId_idx_ca7a2959',
        columns: ['sosEventId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversationParticipant',
        index: 'conversationParticipant_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'conversationParticipant',
        index: 'conversationParticipant_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'disaster',
        index: 'disaster_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'disasterArea',
        index: 'disasterArea_disasterId_idx_55cac62a',
        columns: ['disasterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'location',
        index: 'location_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'location',
        index: 'location_userId_timestamp_idx_41d374b1',
        columns: ['userId', 'timestamp'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_idx_669215a6',
        columns: ['conversationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_conversationId_sentAt_idx_75e06486',
        columns: ['conversationId', 'sentAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'message',
        index: 'message_senderId_idx_4689c490',
        columns: ['senderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_recipientId_idx_c9527cf8',
        columns: ['recipientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_recipientId_read_idx_e1936911',
        columns: ['recipientId', 'read'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueMission',
        index: 'rescueMission_requestId_idx_fd667f92',
        columns: ['requestId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueMission',
        index: 'rescueMission_rescuerId_idx_5ff6cf03',
        columns: ['rescuerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueMission',
        index: 'rescueMission_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueMission',
        index: 'rescueMission_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueRequest',
        index: 'rescueRequest_requesterId_idx_a5f4af92',
        columns: ['requesterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueRequest',
        index: 'rescueRequest_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'rescueTeam',
        index: 'rescueTeam_leaderId_idx_f25e7cb1',
        columns: ['leaderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sOSEvent',
        index: 'sOSEvent_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sOSEvent',
        index: 'sOSEvent_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teamMember',
        index: 'teamMember_teamId_idx_f2b72ab3',
        columns: ['teamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'teamMember',
        index: 'teamMember_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'warning',
        index: 'warning_disasterId_idx_55cac62a',
        columns: ['disasterId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'warning',
        index: 'warning_issuedAt_expiresAt_idx_960ebd43',
        columns: ['issuedAt', 'expiresAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_missionId_fkey',
          columns: ['missionId'],
          references: { schema: 'public', table: 'rescueMission', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversation',
        foreignKey: {
          name: 'conversation_sosEventId_fkey',
          columns: ['sosEventId'],
          references: { schema: 'public', table: 'sOSEvent', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversationParticipant',
        foreignKey: {
          name: 'conversationParticipant_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'conversationParticipant',
        foreignKey: {
          name: 'conversationParticipant_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'disasterArea',
        foreignKey: {
          name: 'disasterArea_disasterId_fkey',
          columns: ['disasterId'],
          references: { schema: 'public', table: 'disaster', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'location',
        foreignKey: {
          name: 'location_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_conversationId_fkey',
          columns: ['conversationId'],
          references: { schema: 'public', table: 'conversation', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'message',
        foreignKey: {
          name: 'message_senderId_fkey',
          columns: ['senderId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_recipientId_fkey',
          columns: ['recipientId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueMission',
        foreignKey: {
          name: 'rescueMission_requestId_fkey',
          columns: ['requestId'],
          references: { schema: 'public', table: 'rescueRequest', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueMission',
        foreignKey: {
          name: 'rescueMission_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'rescueTeam', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueMission',
        foreignKey: {
          name: 'rescueMission_rescuerId_fkey',
          columns: ['rescuerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueProfile',
        foreignKey: {
          name: 'rescueProfile_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueRequest',
        foreignKey: {
          name: 'rescueRequest_requesterId_fkey',
          columns: ['requesterId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'rescueTeam',
        foreignKey: {
          name: 'rescueTeam_leaderId_fkey',
          columns: ['leaderId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sOSEvent',
        foreignKey: {
          name: 'sOSEvent_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'teamMember',
        foreignKey: {
          name: 'teamMember_teamId_fkey',
          columns: ['teamId'],
          references: { schema: 'public', table: 'rescueTeam', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'teamMember',
        foreignKey: {
          name: 'teamMember_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'warning',
        foreignKey: {
          name: 'warning_disasterId_fkey',
          columns: ['disasterId'],
          references: { schema: 'public', table: 'disaster', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      rawSql({
        target: { id: 'disasterArea' },
        precheck: [],
        execute: [{ description: 'Create GiST index for area', sql: 'CREATE INDEX "disasterArea_area_gist_idx" ON "public"."disasterArea" USING GIST ("area");' }],
        postcheck: []
      }),
      rawSql({
        target: { id: 'location' },
        precheck: [],
        execute: [{ description: 'Create GiST index for point', sql: 'CREATE INDEX "location_point_gist_idx" ON "public"."location" USING GIST ("point");' }],
        postcheck: []
      }),
      rawSql({
        target: { id: 'rescueRequest' },
        precheck: [],
        execute: [{ description: 'Create GiST index for location', sql: 'CREATE INDEX "rescueRequest_location_gist_idx" ON "public"."rescueRequest" USING GIST ("location");' }],
        postcheck: []
      }),
      rawSql({
        target: { id: 'sOSEvent' },
        precheck: [],
        execute: [{ description: 'Create GiST index for location', sql: 'CREATE INDEX "sOSEvent_location_gist_idx" ON "public"."sOSEvent" USING GIST ("location");' }],
        postcheck: []
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
