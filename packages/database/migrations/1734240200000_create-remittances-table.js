/* eslint-disable camelcase */

/**
 * REMITTANCES TABLE
 *
 * Purpose: Stores parsed remittance advice files (CSV/PDF) from payers.
 *
 * Key Fields:
 * - payment_code: Reference code used to match with bank feed payments
 * - parsed_content: JSONB field containing extracted line items from the file
 * - filename: Original filename for audit trail
 *
 * Business Rules:
 * - Remittances provide detailed payment breakdowns
 * - payment_code is critical for matching remittance to bank feed payment
 * - parsed_content stores structured data extracted from CSV/PDF
 * - Used to assist in invoice-payment matching when available
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create remittances table
  pgm.createTable('remittances', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    filename: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Original filename of the remittance file',
    },
    file_path: {
      type: 'varchar(500)',
      comment: 'Storage path to the uploaded remittance file',
    },
    email_date: {
      type: 'date',
      comment: 'Date the remittance email was received',
    },
    payer_name: {
      type: 'varchar(255)',
      comment: 'Name of the payer (insurance company, Medicare, etc.)',
    },
    payment_code: {
      type: 'varchar(100)',
      comment: 'Payment reference code for matching with bank feed',
    },
    total_amount: {
      type: 'decimal(10,2)',
      comment: 'Total payment amount from remittance',
    },
    parsed_content: {
      type: 'jsonb',
      comment: 'Extracted line items and details from the remittance file',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add table comment
  pgm.sql(`
    COMMENT ON TABLE remittances IS 'Stores parsed remittance advice files with payment breakdown details';
  `);

  // Create index on payment_code for matching with bank feeds
  pgm.createIndex('remittances', 'payment_code', {
    name: 'idx_remittances_payment_code',
  });

  // Create index on payer_name for filtering by payer
  pgm.createIndex('remittances', 'payer_name', {
    name: 'idx_remittances_payer_name',
  });

  // Create index on email_date for date-based queries
  pgm.createIndex('remittances', 'email_date', {
    name: 'idx_remittances_email_date',
  });

  // Create GIN index on parsed_content for JSONB queries
  pgm.createIndex('remittances', 'parsed_content', {
    name: 'idx_remittances_parsed_content',
    method: 'gin',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('remittances', { ifExists: true, cascade: true });
};
