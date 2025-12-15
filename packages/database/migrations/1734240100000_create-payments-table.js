/* eslint-disable camelcase */

/**
 * PAYMENTS TABLE
 *
 * Purpose: Stores payment records from bank feeds and auto-reconciled sources.
 *
 * Key Fields:
 * - auto_reconciled: TRUE for Tyro, Medicare EasyClaim, DVA auto-reconciled payments
 * - auto_reconciled_source: Identifies the source system (TYRO, MEDICARE_EASYCLAIM, DVA)
 * - status: unmatched, matched, partially_matched, auto_reconciled
 *
 * Business Rules:
 * - Auto-reconciled payments skip manual matching workflow
 * - Payment date used for date range queries and reporting
 * - Status updates based on invoice matching process
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create payments table
  pgm.createTable('payments', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    payment_date: {
      type: 'date',
      notNull: true,
      comment: 'Date the payment was received',
    },
    amount: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Payment amount',
    },
    description: {
      type: 'text',
      comment: 'Payment description from bank feed or source system',
    },
    auto_reconciled: {
      type: 'boolean',
      default: false,
      comment: 'TRUE for Tyro, Medicare, DVA auto-reconciled payments',
    },
    auto_reconciled_source: {
      type: 'varchar(50)',
      comment: 'Source system: TYRO, MEDICARE_EASYCLAIM, DVA, etc.',
    },
    status: {
      type: 'varchar(50)',
      default: 'unmatched',
      comment: 'Payment status: unmatched, matched, partially_matched, auto_reconciled',
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
    COMMENT ON TABLE payments IS 'Stores payment records from bank feeds and auto-reconciled sources (Tyro, Medicare, DVA)';
  `);

  // Create index on payment_date for date range queries (CRITICAL for reporting)
  pgm.createIndex('payments', 'payment_date', {
    name: 'idx_payments_payment_date',
  });

  // Create index on status for filtering unmatched payments
  pgm.createIndex('payments', 'status', {
    name: 'idx_payments_status',
  });

  // Create index on auto_reconciled for separating manual vs auto payments
  pgm.createIndex('payments', 'auto_reconciled', {
    name: 'idx_payments_auto_reconciled',
  });

  // Create composite index for auto-reconciled source filtering
  pgm.createIndex('payments', ['auto_reconciled', 'auto_reconciled_source'], {
    name: 'idx_payments_auto_source',
  });

  // Create trigger for payments updated_at
  pgm.createTrigger('payments', 'update_payments_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('payments', 'update_payments_updated_at', { ifExists: true });
  pgm.dropTable('payments', { ifExists: true, cascade: true });
};
