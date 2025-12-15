/* eslint-disable camelcase */

/**
 * RECONCILIATION_AUDIT TABLE
 *
 * Purpose: Comprehensive audit trail for all system actions and changes.
 *
 * Key Fields:
 * - action: Type of action (upload, match, confirm, reject, modify, pattern_learned)
 * - entity_type: What was affected (invoice, payment, match, manual_match_pattern)
 * - entity_id: ID of the affected record
 * - user_id: Who performed the action
 * - details: JSONB field with action-specific details
 *
 * Business Rules:
 * - NEVER delete audit records - they are permanent compliance records
 * - Captures all user actions for accountability
 * - Tracks system-generated actions (pattern learning, auto-matching)
 * - Details field stores before/after values for modifications
 * - Critical for debugging, compliance, and understanding system behavior
 *
 * Example Audit Records:
 * - Action: "upload", Entity: "payment", Details: { filename: "bank_feed.csv", rows: 50 }
 * - Action: "match", Entity: "match", Details: { payment_id: "...", invoice_id: "...", confidence: 85.5 }
 * - Action: "confirm", Entity: "match", Details: { match_id: "...", previous_status: "pending" }
 * - Action: "pattern_learned", Entity: "manual_match_pattern", Details: { pattern: "MEDICARE", boost: 10 }
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create reconciliation_audit table
  pgm.createTable('reconciliation_audit', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    action: {
      type: 'varchar(100)',
      comment: 'Action performed: upload, match, confirm, reject, modify, pattern_learned, etc.',
    },
    entity_type: {
      type: 'varchar(50)',
      comment: 'Type of entity affected: invoice, payment, match, manual_match_pattern, etc.',
    },
    entity_id: {
      type: 'uuid',
      comment: 'ID of the affected entity',
    },
    user_id: {
      type: 'varchar(255)',
      comment: 'User who performed the action (or "SYSTEM" for automated actions)',
    },
    details: {
      type: 'jsonb',
      comment: 'Action-specific details including before/after values',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
      comment: 'When the action occurred',
    },
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE reconciliation_audit IS 'PERMANENT audit trail for all system actions - NEVER delete records';
  `);

  // Create index on action for filtering by action type
  pgm.createIndex('reconciliation_audit', 'action', {
    name: 'idx_audit_action',
  });

  // Create index on entity_type for filtering by entity
  pgm.createIndex('reconciliation_audit', 'entity_type', {
    name: 'idx_audit_entity_type',
  });

  // Create index on entity_id for finding all actions on a specific record
  pgm.createIndex('reconciliation_audit', 'entity_id', {
    name: 'idx_audit_entity_id',
  });

  // Create index on user_id for tracking user actions
  pgm.createIndex('reconciliation_audit', 'user_id', {
    name: 'idx_audit_user_id',
  });

  // Create index on created_at for time-based queries
  pgm.createIndex('reconciliation_audit', 'created_at', {
    name: 'idx_audit_created_at',
  });

  // Create composite index for finding actions by entity
  pgm.createIndex('reconciliation_audit', ['entity_type', 'entity_id'], {
    name: 'idx_audit_entity_lookup',
  });

  // Create composite index for user activity tracking
  pgm.createIndex('reconciliation_audit', ['user_id', 'created_at'], {
    name: 'idx_audit_user_activity',
  });

  // Create GIN index on details for JSONB queries
  pgm.createIndex('reconciliation_audit', 'details', {
    name: 'idx_audit_details',
    method: 'gin',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('reconciliation_audit', { ifExists: true, cascade: true });
};
