/* eslint-disable camelcase */

/**
 * MATCHES TABLE
 *
 * Purpose: Records invoice-payment matches with confidence scoring and approval workflow.
 *
 * Key Fields:
 * - match_type: perfect_match, partial_payment, overpaid, high_confidence, remittance_assisted, fuzzy, manual
 * - match_confidence: 0-100 score indicating confidence level
 * - status: pending, confirmed, rejected (approval workflow)
 * - is_manual: Distinguishes manual matches from automated ones
 *
 * Business Rules:
 * - Links payments to invoices with confidence scoring
 * - Optional remittance_id for remittance-assisted matching
 * - Requires confirmation for matches below certain confidence threshold
 * - Tracks who confirmed and when for audit purposes
 * - Manual matches bypass automated confidence scoring
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create matches table
  pgm.createTable('matches', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    payment_id: {
      type: 'uuid',
      references: 'payments(id)',
      onDelete: 'CASCADE',
      comment: 'Reference to the payment being matched',
    },
    invoice_id: {
      type: 'uuid',
      references: 'invoices(id)',
      onDelete: 'CASCADE',
      comment: 'Reference to the invoice being matched',
    },
    remittance_id: {
      type: 'uuid',
      references: 'remittances(id)',
      onDelete: 'SET NULL',
      comment: 'Optional reference to remittance that assisted the match',
    },
    match_type: {
      type: 'varchar(50)',
      comment: 'Type: perfect_match, partial_payment, overpaid, high_confidence, remittance_assisted, fuzzy, manual',
    },
    match_confidence: {
      type: 'decimal(5,2)',
      comment: 'Confidence score from 0-100',
    },
    amount_matched: {
      type: 'decimal(10,2)',
      comment: 'Amount being matched (may be partial)',
    },
    status: {
      type: 'varchar(50)',
      default: 'pending',
      comment: 'Approval status: pending, confirmed, rejected',
    },
    matched_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
      comment: 'When the match was created',
    },
    confirmed_by: {
      type: 'varchar(255)',
      comment: 'User who confirmed or rejected the match',
    },
    confirmed_at: {
      type: 'timestamp',
      comment: 'When the match was confirmed/rejected',
    },
    is_manual: {
      type: 'boolean',
      default: false,
      comment: 'TRUE if manually created/approved, FALSE if automated',
    },
    notes: {
      type: 'text',
      comment: 'Additional notes about the match',
    },
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE matches IS 'Records invoice-payment matches with confidence scoring and approval workflow';
  `);

  // Create index on payment_id for finding matches by payment (CRITICAL for join performance)
  pgm.createIndex('matches', 'payment_id', {
    name: 'idx_matches_payment_id',
  });

  // Create index on invoice_id for finding matches by invoice (CRITICAL for join performance)
  pgm.createIndex('matches', 'invoice_id', {
    name: 'idx_matches_invoice_id',
  });

  // Create index on remittance_id for remittance-assisted matches
  pgm.createIndex('matches', 'remittance_id', {
    name: 'idx_matches_remittance_id',
  });

  // Create index on status for filtering pending/confirmed/rejected matches
  pgm.createIndex('matches', 'status', {
    name: 'idx_matches_status',
  });

  // Create composite index for finding pending matches
  pgm.createIndex('matches', ['status', 'match_confidence'], {
    name: 'idx_matches_status_confidence',
  });

  // Create index on match_type for analytics
  pgm.createIndex('matches', 'match_type', {
    name: 'idx_matches_match_type',
  });

  // Create index on is_manual for separating manual vs automated matches
  pgm.createIndex('matches', 'is_manual', {
    name: 'idx_matches_is_manual',
  });

  // Add constraint to ensure match_confidence is between 0 and 100
  pgm.addConstraint('matches', 'check_match_confidence_range', {
    check: 'match_confidence >= 0 AND match_confidence <= 100',
  });

  // Add constraint to ensure amount_matched is positive
  pgm.addConstraint('matches', 'check_amount_matched_positive', {
    check: 'amount_matched > 0',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('matches', { ifExists: true, cascade: true });
};
