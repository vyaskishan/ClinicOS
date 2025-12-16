import {
  parseCSV,
  CSVValidationRule,
  formatDateToISO,
  normalizeCurrency,
  normalizeString,
} from '../utils/csv-parser';
import { transaction } from '../config/database';
import { PoolClient } from 'pg';

/**
 * INVOICE UPLOAD SERVICE
 *
 * Purpose: Process CSV file uploads for invoices with validation and database insertion.
 *
 * CSV Structure:
 * invoice_number,invoice_date,patient_name,payee_name,amount,outstanding_amount,description,status
 *
 * Features:
 * - Validates required columns
 * - Transforms dates to ISO format
 * - Normalizes currency amounts
 * - Trims whitespace
 * - Skips malformed rows with error logging
 * - Transaction-based insertion
 * - Returns detailed upload summary
 */

export interface InvoiceCSVRow {
  invoice_number: string;
  invoice_date: string;
  patient_name: string;
  payee_name: string;
  amount: number;
  outstanding_amount: number;
  description?: string;
  status: string;
}

export interface InvoiceUploadResult {
  success: boolean;
  summary: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    paidCount: number;
    unpaidCount: number;
    partiallyPaidCount: number;
  };
  errors: Array<{ row: number; error: string }>;
}

/**
 * Required columns for invoice CSV
 */
const REQUIRED_COLUMNS = [
  'invoice_number',
  'invoice_date',
  'patient_name',
  'payee_name',
  'amount',
  'outstanding_amount',
  'status',
];

/**
 * Validation rules for invoice CSV columns
 */
const VALIDATION_RULES: CSVValidationRule[] = [
  {
    column: 'invoice_number',
    required: true,
    type: 'string',
    validate: (value) => {
      const trimmed = String(value).trim();
      if (trimmed.length > 6) {
        return 'Invoice number must be 6 characters or less';
      }
      return true;
    },
    transform: (value) => normalizeString(value),
  },
  {
    column: 'invoice_date',
    required: true,
    type: 'date',
    transform: (value) => formatDateToISO(value),
  },
  {
    column: 'patient_name',
    required: true,
    type: 'string',
    transform: (value) => normalizeString(value),
  },
  {
    column: 'payee_name',
    required: true,
    type: 'string',
    transform: (value) => normalizeString(value),
  },
  {
    column: 'amount',
    required: true,
    type: 'decimal',
    validate: (value) => {
      const num = Number(value);
      if (num <= 0) {
        return 'Amount must be greater than 0';
      }
      return true;
    },
    transform: (value) => normalizeCurrency(value),
  },
  {
    column: 'outstanding_amount',
    required: true,
    type: 'decimal',
    validate: (value) => {
      const num = Number(value);
      if (num < 0) {
        return 'Outstanding amount cannot be negative';
      }
      return true;
    },
    transform: (value) => normalizeCurrency(value),
  },
  {
    column: 'description',
    required: false,
    type: 'string',
    transform: (value) => (value ? normalizeString(value) : null),
  },
  {
    column: 'status',
    required: true,
    type: 'string',
    validate: (value) => {
      const validStatuses = ['unpaid', 'partially_paid', 'fully_paid', 'paid'];
      const normalized = String(value).toLowerCase().trim();
      if (!validStatuses.includes(normalized)) {
        return `Status must be one of: ${validStatuses.join(', ')}`;
      }
      return true;
    },
    transform: (value) => {
      const normalized = String(value).toLowerCase().trim();
      // Normalize 'paid' to 'fully_paid'
      return normalized === 'paid' ? 'fully_paid' : normalized;
    },
  },
];

/**
 * Process invoice CSV upload
 *
 * @param filePath Path to uploaded CSV file
 * @returns Upload result with summary and errors
 */
export async function processInvoiceUpload(
  filePath: string
): Promise<InvoiceUploadResult> {
  console.log(`📄 Processing invoice upload: ${filePath}`);

  // Parse CSV with validation
  const parseResult = await parseCSV<InvoiceCSVRow>(
    filePath,
    REQUIRED_COLUMNS,
    VALIDATION_RULES
  );

  console.log(
    `   Parsed ${parseResult.successCount}/${parseResult.totalRows} rows successfully`
  );

  if (parseResult.errorCount > 0) {
    console.warn(`   ⚠️  Skipped ${parseResult.errorCount} rows due to errors`);
  }

  // Additional validation: outstanding_amount <= amount
  const validatedInvoices: InvoiceCSVRow[] = [];
  const additionalErrors: Array<{ row: number; error: string }> = [];

  parseResult.data.forEach((invoice, index) => {
    if (invoice.outstanding_amount > invoice.amount) {
      additionalErrors.push({
        row: index + 1,
        error: `Outstanding amount ($${invoice.outstanding_amount}) cannot exceed total amount ($${invoice.amount})`,
      });
    } else {
      validatedInvoices.push(invoice);
    }
  });

  // Insert into database using transaction
  let insertedCount = 0;
  const insertErrors: Array<{ row: number; error: string }> = [];

  if (validatedInvoices.length > 0) {
    try {
      await transaction(async (client: PoolClient) => {
        for (const invoice of validatedInvoices) {
          try {
            await insertInvoice(client, invoice);
            insertedCount++;
          } catch (error: any) {
            insertErrors.push({
              row: validatedInvoices.indexOf(invoice) + 1,
              error: error.message,
            });
          }
        }
      });
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  // Calculate summary statistics
  const paidCount = validatedInvoices.filter(
    (inv) => inv.status === 'fully_paid'
  ).length;
  const unpaidCount = validatedInvoices.filter((inv) => inv.status === 'unpaid').length;
  const partiallyPaidCount = validatedInvoices.filter(
    (inv) => inv.status === 'partially_paid'
  ).length;

  const allErrors = [
    ...parseResult.errors.map((e) => ({ row: e.row, error: e.error })),
    ...additionalErrors,
    ...insertErrors,
  ];

  console.log(`✅ Successfully inserted ${insertedCount} invoices`);

  return {
    success: true,
    summary: {
      totalRows: parseResult.totalRows,
      successCount: insertedCount,
      errorCount: allErrors.length,
      paidCount,
      unpaidCount,
      partiallyPaidCount,
    },
    errors: allErrors,
  };
}

/**
 * Insert invoice into database
 *
 * @param client Database client
 * @param invoice Invoice data
 */
async function insertInvoice(client: PoolClient, invoice: InvoiceCSVRow): Promise<void> {
  const query = `
    INSERT INTO invoices (
      invoice_number,
      invoice_date,
      patient_name,
      payee_name,
      amount,
      outstanding_amount,
      description,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (invoice_number) DO UPDATE SET
      invoice_date = EXCLUDED.invoice_date,
      patient_name = EXCLUDED.patient_name,
      payee_name = EXCLUDED.payee_name,
      amount = EXCLUDED.amount,
      outstanding_amount = EXCLUDED.outstanding_amount,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      updated_at = CURRENT_TIMESTAMP
  `;

  await client.query(query, [
    invoice.invoice_number,
    invoice.invoice_date,
    invoice.patient_name,
    invoice.payee_name,
    invoice.amount,
    invoice.outstanding_amount,
    invoice.description,
    invoice.status,
  ]);
}
