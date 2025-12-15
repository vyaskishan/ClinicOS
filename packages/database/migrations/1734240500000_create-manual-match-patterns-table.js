/* eslint-disable camelcase */

/**
 * MANUAL_MATCH_PATTERNS TABLE
 *
 * Purpose: Machine learning table that learns from user matching decisions.
 *
 * Key Fields:
 * - bank_description_pattern: Pattern extracted from bank feed description
 * - payee_name: Associated payee name learned from manual matches
 * - patient_name: Associated patient name (if applicable)
 * - match_confidence_boost: How much to boost confidence when pattern matches (default: 10.00)
 * - times_used: Tracks how often this pattern has been applied
 * - success_rate: Percentage of times this pattern led to confirmed matches
 * - created_from_match_id: Audit trail to original manual match
 *
 * Business Rules:
 * - CRITICAL for system learning - DO NOT delete or modify without understanding impact
 * - When user manually matches payment to invoice, system creates/updates pattern
 * - Future automated matches check these patterns and boost confidence
 * - success_rate tracks effectiveness - low success patterns should be reviewed
 * - Higher success_rate patterns should get higher confidence boosts
 *
 * Machine Learning Flow:
 * 1. User manually matches payment "BPAY MEDICARE 12345" to invoice for "John Smith"
 * 2. System creates pattern: bank_description_pattern="MEDICARE", payee_name="Medicare Australia"
 * 3. Next time payment with "MEDICARE" appears, confidence boosted by 10 points
 * 4. If match confirmed, success_rate increases; if rejected, decreases
 * 5. System learns over time which patterns are most reliable
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create manual_match_patterns table
  pgm.createTable('manual_match_patterns', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    bank_description_pattern: {
      type: 'varchar(500)',
      comment: 'Pattern extracted from bank feed description',
    },
    payee_name: {
      type: 'varchar(255)',
      comment: 'Associated payee name learned from manual matches',
    },
    patient_name: {
      type: 'varchar(255)',
      comment: 'Associated patient name (if applicable)',
    },
    match_confidence_boost: {
      type: 'decimal(5,2)',
      default: 10.00,
      comment: 'Confidence boost to apply when pattern matches (0-100)',
    },
    times_used: {
      type: 'integer',
      default: 0,
      comment: 'Number of times this pattern has been applied',
    },
    success_rate: {
      type: 'decimal(5,2)',
      default: 100.00,
      comment: 'Percentage of times this pattern led to confirmed match (0-100)',
    },
    created_from_match_id: {
      type: 'uuid',
      references: 'matches(id)',
      onDelete: 'SET NULL',
      comment: 'Audit trail to the manual match that created this pattern',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE manual_match_patterns IS 'CRITICAL: Machine learning table that learns from user matching decisions to improve automated matching';
  `);

  // Create index on bank_description_pattern for fast pattern matching
  pgm.createIndex('manual_match_patterns', 'bank_description_pattern', {
    name: 'idx_manual_patterns_bank_description',
  });

  // Create case-insensitive index for bank_description_pattern (for fuzzy matching)
  pgm.sql(`
    CREATE INDEX idx_manual_patterns_bank_description_lower
    ON manual_match_patterns (LOWER(bank_description_pattern));
  `);

  // Create index on payee_name for filtering by payee
  pgm.createIndex('manual_match_patterns', 'payee_name', {
    name: 'idx_manual_patterns_payee_name',
  });

  // Create index on patient_name for patient-specific patterns
  pgm.createIndex('manual_match_patterns', 'patient_name', {
    name: 'idx_manual_patterns_patient_name',
  });

  // Create index on success_rate for finding high-quality patterns
  pgm.createIndex('manual_match_patterns', 'success_rate', {
    name: 'idx_manual_patterns_success_rate',
  });

  // Create composite index for finding effective patterns
  pgm.createIndex('manual_match_patterns', ['success_rate', 'times_used'], {
    name: 'idx_manual_patterns_effectiveness',
  });

  // Create trigger for updated_at
  pgm.createTrigger('manual_match_patterns', 'update_manual_match_patterns_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Add constraint to ensure success_rate is between 0 and 100
  pgm.addConstraint('manual_match_patterns', 'check_success_rate_range', {
    check: 'success_rate >= 0 AND success_rate <= 100',
  });

  // Add constraint to ensure match_confidence_boost is between 0 and 100
  pgm.addConstraint('manual_match_patterns', 'check_confidence_boost_range', {
    check: 'match_confidence_boost >= 0 AND match_confidence_boost <= 100',
  });

  // Add constraint to ensure times_used is non-negative
  pgm.addConstraint('manual_match_patterns', 'check_times_used_nonnegative', {
    check: 'times_used >= 0',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('manual_match_patterns', 'update_manual_match_patterns_updated_at', {
    ifExists: true,
  });
  pgm.dropTable('manual_match_patterns', { ifExists: true, cascade: true });
};
