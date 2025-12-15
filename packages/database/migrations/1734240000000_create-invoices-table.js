/* eslint-disable camelcase */

/**
 * INVOICES TABLE
 *
 * Purpose: Stores invoice records from the clinic billing system.
 *
 * Key Fields:
 * - invoice_number: 6-character unique identifier
 * - outstanding_amount: Tracks remaining unpaid balance
 * - status: unpaid, partially_paid, fully_paid
 *
 * Business Rules:
 * - Invoice numbers must be unique across all invoices
 * - Outstanding amount should never exceed total amount
 * - Status updates based on payment matching
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Enable UUID generation extension
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  // Create invoices table
  pgm.createTable('invoices', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    invoice_number: {
      type: 'varchar(6)',
      notNull: true,
      unique: true,
      comment: 'Unique 6-character invoice identifier',
    },
    invoice_date: {
      type: 'date',
      notNull: true,
      comment: 'Date the invoice was issued',
    },
    patient_name: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Name of the patient receiving services',
    },
    payee_name: {
      type: 'varchar(255)',
      notNull: true,
      comment: 'Name of the entity responsible for payment (patient or insurance)',
    },
    amount: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Total invoice amount',
    },
    outstanding_amount: {
      type: 'decimal(10,2)',
      notNull: true,
      comment: 'Remaining unpaid balance',
    },
    description: {
      type: 'text',
      comment: 'Invoice description or notes',
    },
    status: {
      type: 'varchar(50)',
      default: 'unpaid',
      comment: 'Payment status: unpaid, partially_paid, fully_paid',
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
    COMMENT ON TABLE invoices IS 'Stores invoice records from clinic billing system with payment tracking';
  `);

  // Create index on invoice_number for fast lookups
  pgm.createIndex('invoices', 'invoice_number', {
    name: 'idx_invoices_invoice_number',
  });

  // Create index on status for filtering
  pgm.createIndex('invoices', 'status', {
    name: 'idx_invoices_status',
  });

  // Create index on invoice_date for date range queries
  pgm.createIndex('invoices', 'invoice_date', {
    name: 'idx_invoices_invoice_date',
  });

  // Create index on payee_name for grouping and searching
  pgm.createIndex('invoices', 'payee_name', {
    name: 'idx_invoices_payee_name',
  });

  // Create trigger function for updated_at
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    `
  );

  // Create trigger for invoices
  pgm.createTrigger('invoices', 'update_invoices_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at_column',
    level: 'ROW',
  });

  // Add constraint to ensure outstanding_amount <= amount
  pgm.addConstraint('invoices', 'check_outstanding_amount', {
    check: 'outstanding_amount <= amount',
  });
};

exports.down = (pgm) => {
  pgm.dropTrigger('invoices', 'update_invoices_updated_at', { ifExists: true });
  pgm.dropFunction('update_updated_at_column', [], { ifExists: true, cascade: true });
  pgm.dropTable('invoices', { ifExists: true, cascade: true });
  pgm.dropExtension('pgcrypto', { ifExists: true });
};
